import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expense, ExpenseSource, ExpenseStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AnthropicCredentialsService } from '../ai-credentials/anthropic/anthropic-credentials.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveRfqInboundAttachmentMime } from '../rfq-analysis/rfq-inbound-attachment-mime';
import { sanitizeInboundEmailText } from '../rfq-analysis/rfq-email-inbound-text';
import { ExpenseExtractProducer } from '../queue/producers/expense-extract-producer.service';
import { ExpenseStorageService } from './expense-storage.service';
import { ExpenseAiService } from './expense-ai.service';
import { convertHeicBufferToJpeg, heicFileNameToJpeg, isHeicFile } from './expense-image.utils';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { SyncExpenseImportStatusDto } from './dto/sync-expense-import-status.dto';
import type { ExpenseEmailInboundDto } from './dto/expense-email-inbound.dto';
import { isExpenseCategory } from './expense-categories';
import { getExpenseMaxFileBytes } from './expenses.config';

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'pdf', 'heic', 'heif']);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

export type ExpenseFileDownload = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

type ExpenseEmailSkippedAttachment = {
  fileName: string;
  reason: string;
};

type ExpenseEmailInboundResult = {
  ok: boolean;
  reason?: string;
  expenseIds?: string[];
  skipped?: ExpenseEmailSkippedAttachment[];
};

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly creds: AnthropicCredentialsService,
    private readonly storage: ExpenseStorageService,
    private readonly ai: ExpenseAiService,
    private readonly producer: ExpenseExtractProducer,
  ) {}

  async list(userId: string) {
    const items = await this.prisma.expense.findMany({
      where: { userId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return { items: items.map(mapExpense) };
  }

  async getOne(userId: string, id: string) {
    const expense = await this.ensureOwned(userId, id);
    return mapExpense(expense);
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const expense = await this.ensureOwned(userId, id);
    await this.prisma.expense.delete({ where: { id: expense.id } });
    try {
      await this.storage.deleteExpenseFolder(expense.id);
    } catch (err) {
      this.logger.warn(
        `No se pudo borrar carpeta del gasto ${expense.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return { ok: true };
  }

  async bulkDelete(userId: string, ids: string[]): Promise<{ ok: true; deleted: number }> {
    const uniqueIds = [...new Set(ids)];
    const expenses = await this.prisma.expense.findMany({
      where: { userId, id: { in: uniqueIds } },
      select: { id: true },
    });
    if (!expenses.length) {
      return { ok: true, deleted: 0 };
    }

    const expenseIds = expenses.map((expense) => expense.id);
    const result = await this.prisma.expense.deleteMany({
      where: { userId, id: { in: expenseIds } },
    });

    for (const id of expenseIds) {
      try {
        await this.storage.deleteExpenseFolder(id);
      } catch (err) {
        this.logger.warn(
          `No se pudo borrar carpeta del gasto ${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { ok: true, deleted: result.count };
  }

  async extract(userId: string, file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Falta el archivo del recibo');
    }
    validateReceiptFile(file);

    const id = randomUUID();
    const saved = await this.storage.saveUploadedFile(id, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });

    let expense = await this.prisma.expense.create({
      data: {
        id,
        userId,
        fileUrl: `/expenses/${id}/file`,
        originalFileName: saved.fileName,
        storagePath: saved.storedPath,
        mimeType: saved.mimeType,
        status: ExpenseStatus.PENDING_REVIEW,
      },
    });

    expense = await this.runExtraction(userId, expense);
    return mapExpense(expense);
  }

  async handleInboundEmail(dto: ExpenseEmailInboundDto): Promise<ExpenseEmailInboundResult> {
    const expected = this.config.get<string>('EXPENSE_EMAIL_WEBHOOK_SECRET')?.trim();
    if (!expected) {
      this.logger.warn('EXPENSE_EMAIL_WEBHOOK_SECRET no configurada');
      throw new ServiceUnavailableException('Webhook no disponible');
    }
    if (dto.secret !== expected) {
      throw new UnauthorizedException('Secreto inválido');
    }

    const email = dto.fromEmail.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.logger.warn(`Expense email rechazado: remitente no registrado ${email}`);
      return { ok: false, reason: 'unknown_sender' };
    }

    try {
      await this.creds.getApiKeyPlainOrThrow(user.id);
    } catch {
      this.logger.warn(`Expense email rechazado: usuario sin clave Anthropic ${email}`);
      return { ok: false, reason: 'no_anthropic_key' };
    }

    const attachments = dto.attachments ?? [];
    const maxAtt = getExpenseEmailMaxAttachments(this.config);
    const maxFile = getExpenseMaxFileBytes(this.config);
    const maxTotal = maxAtt * maxFile;

    if (attachments.length > maxAtt) {
      this.logger.warn(`Expense email rechazado: demasiados adjuntos (${attachments.length})`);
      return { ok: false, reason: 'too_many_attachments' };
    }

    let estimatedTotal = 0;
    for (const att of attachments) {
      const b64len = att.contentBase64?.length ?? 0;
      const approx = Math.floor((b64len * 3) / 4);
      if (approx > maxFile) {
        this.logger.warn(
          `Expense email rechazado: adjunto supera límite por fichero (aprox ${formatBytesHuman(approx)} > máx ${formatBytesHuman(maxFile)}, fileName=${att.fileName?.slice(0, 120) ?? '?'})`,
        );
        return { ok: false, reason: 'attachment_too_large' };
      }
      estimatedTotal += approx;
    }
    if (estimatedTotal > maxTotal) {
      this.logger.warn(
        `Expense email rechazado: tamaño total de adjuntos aprox ${formatBytesHuman(estimatedTotal)} > máx ${formatBytesHuman(maxTotal)}`,
      );
      return { ok: false, reason: 'total_size_exceeded' };
    }

    const fallbackDescription = buildExpenseEmailFallbackDescription(sanitizeInboundEmailText(dto.subject));
    const expenseIds: string[] = [];
    const skipped: ExpenseEmailSkippedAttachment[] = [];

    for (const att of attachments) {
      const buffer = Buffer.from(att.contentBase64, 'base64');
      if (buffer.length > maxFile) {
        this.logger.warn(
          `Expense email: tras decodificar base64, adjunto ${formatBytesHuman(buffer.length)} > máx ${formatBytesHuman(maxFile)} (${att.fileName?.slice(0, 120) ?? '?'})`,
        );
        return { ok: false, reason: 'attachment_too_large' };
      }

      const resolvedMime = resolveExpenseInboundAttachmentMime({
        contentType: att.contentType,
        mimeType: att.mimeType,
        fileName: att.fileName,
      });

      try {
        validateReceiptFile({ originalname: att.fileName, mimetype: resolvedMime });
      } catch {
        skipped.push({ fileName: att.fileName, reason: 'unsupported_format' });
        continue;
      }

      const id = randomUUID();
      const saved = await this.storage.saveUploadedFile(id, {
        buffer,
        originalname: att.fileName,
        mimetype: resolvedMime,
      });
      const expense = await this.prisma.expense.create({
        data: {
          id,
          userId: user.id,
          fileUrl: `/expenses/${id}/file`,
          originalFileName: saved.fileName,
          storagePath: saved.storedPath,
          mimeType: saved.mimeType,
          description: fallbackDescription,
          status: ExpenseStatus.PENDING_REVIEW,
          source: ExpenseSource.EMAIL,
        },
      });
      await this.producer.enqueueExpenseExtract({ expenseId: expense.id, userId: user.id });
      expenseIds.push(expense.id);
    }

    if (!expenseIds.length) {
      return { ok: false, reason: 'no_valid_attachments', skipped: skipped.length ? skipped : undefined };
    }

    return { ok: true, expenseIds, skipped: skipped.length ? skipped : undefined };
  }

  async convertHeicUpload(file: Express.Multer.File | undefined): Promise<ExpenseFileDownload> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Falta el archivo HEIC');
    }
    const isHeic = isHeicFile(file.mimetype, file.originalname);
    if (!isHeic) {
      throw new BadRequestException('El archivo no es HEIC/HEIF.');
    }
    try {
      const buffer = await convertHeicBufferToJpeg(file.buffer);
      return {
        buffer,
        mimeType: 'image/jpeg',
        fileName: heicFileNameToJpeg(file.originalname || 'receipt.heic'),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`No se pudo convertir el archivo HEIC a JPG. Detalle: ${message}`);
    }
  }

  async retryExtract(userId: string, id: string) {
    const expense = await this.ensureOwned(userId, id);
    const next = await this.runExtraction(userId, expense);
    return mapExpense(next);
  }

  async processQueuedExtraction(userId: string, id: string): Promise<void> {
    const expense = await this.ensureOwned(userId, id);
    await this.runExtraction(userId, expense, { rethrow: true });
  }

  async update(userId: string, id: string, dto: UpdateExpenseDto) {
    await this.ensureOwned(userId, id);
    if (!isExpenseCategory(dto.type)) {
      throw new BadRequestException('Tipo de gasto no válido');
    }
    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        amount: new Prisma.Decimal(dto.amount),
        type: dto.type,
        description: dto.description.trim(),
        date: new Date(dto.date),
        ...(dto.paidByCompany == null ? {} : { paidByCompany: dto.paidByCompany }),
        status: ExpenseStatus.PROCESSED,
        extractionError: null,
      },
    });
    return mapExpense(updated);
  }

  async syncImportStatus(userId: string, dto: SyncExpenseImportStatusDto) {
    const loadedIds = dto.expenses.filter((expense) => expense.loaded).map((expense) => expense.id);
    const notLoadedIds = dto.expenses.filter((expense) => !expense.loaded).map((expense) => expense.id);

    const operations: Prisma.PrismaPromise<Prisma.BatchPayload>[] = [];
    if (loadedIds.length) {
      operations.push(
        this.prisma.expense.updateMany({
          where: { userId, id: { in: loadedIds } },
          data: { loaded: true },
        }),
      );
    }
    if (notLoadedIds.length) {
      operations.push(
        this.prisma.expense.updateMany({
          where: { userId, id: { in: notLoadedIds } },
          data: { loaded: false },
        }),
      );
    }

    const results = operations.length ? await this.prisma.$transaction(operations) : [];
    return {
      ok: true,
      updated: results.reduce((total, result) => total + result.count, 0),
    };
  }

  async getFile(userId: string, id: string): Promise<ExpenseFileDownload> {
    const expense = await this.ensureOwned(userId, id);
    let buffer = await this.storage.readFile(expense.storagePath).catch(() => {
      throw new NotFoundException('Archivo del recibo no encontrado');
    });
    let mimeType = expense.mimeType;
    let fileName = expense.originalFileName;

    if (isHeicFile(mimeType, fileName)) {
      try {
        buffer = await convertHeicBufferToJpeg(buffer);
        mimeType = 'image/jpeg';
        fileName = heicFileNameToJpeg(fileName);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`No se pudo convertir HEIC al servir recibo ${expense.id}: ${message}`);
      }
    }

    return {
      buffer,
      mimeType,
      fileName,
    };
  }

  private async ensureOwned(userId: string, id: string): Promise<Expense> {
    const expense = await this.prisma.expense.findFirst({ where: { id, userId } });
    if (!expense) {
      throw new NotFoundException('Gasto no encontrado');
    }
    return expense;
  }

  private async runExtraction(
    userId: string,
    expense: Expense,
    options: { rethrow?: boolean } = {},
  ): Promise<Expense> {
    try {
      const buffer = await this.storage.readFile(expense.storagePath);
      const extracted = await this.ai.extract(userId, {
        buffer,
        fileName: expense.originalFileName,
        mimeType: expense.mimeType,
      });
      return this.prisma.expense.update({
        where: { id: expense.id },
        data: {
          amount: extracted.amount != null ? new Prisma.Decimal(extracted.amount) : null,
          type: extracted.type,
          description: extracted.description ?? expense.description,
          date: extracted.date ? new Date(extracted.date) : null,
          extractionError: null,
          rawModelOutput: extracted.rawModelOutput,
          modelId: extracted.modelId,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`No se pudo extraer recibo ${expense.id}: ${message}`);
      const updated = await this.prisma.expense.update({
        where: { id: expense.id },
        data: {
          extractionError: message,
          rawModelOutput: null,
          modelId: null,
        },
      });
      if (options.rethrow) {
        throw err;
      }
      return updated;
    }
  }
}

function validateReceiptFile(file: { originalname: string; mimetype: string }): void {
  const ext = extensionOf(file.originalname);
  const mime = (file.mimetype || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_MIME_TYPES.has(mime)) {
    throw new BadRequestException('Formato no soportado. Usa JPG, JPEG, PNG, PDF o HEIC.');
  }
}

function getExpenseEmailMaxAttachments(config: ConfigService): number {
  const raw = config.get<string>('EXPENSE_EMAIL_MAX_ATTACHMENTS');
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function formatBytesHuman(bytes: number): string {
  if (!Number.isFinite(bytes)) return `${bytes}`;
  const mib = bytes / (1024 * 1024);
  return `${mib.toFixed(1)} MiB`;
}

function buildExpenseEmailFallbackDescription(subject: string | undefined): string | null {
  if (!subject) return null;
  const cleaned = subject
    .replace(/^(re|rv|fw|fwd)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? `Email: ${cleaned.slice(0, 180)}` : null;
}

function resolveExpenseInboundAttachmentMime(input: {
  contentType?: string | null;
  mimeType?: string | null;
  fileName: string;
}): string {
  const resolved = resolveRfqInboundAttachmentMime(input);
  if (resolved !== 'application/octet-stream') return resolved;
  const ext = extensionOf(input.fileName);
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  return resolved;
}

function extensionOf(fileName: string): string {
  const parts = String(fileName ?? '').toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function apiStatus(status: ExpenseStatus): 'pending_review' | 'processed' {
  return status === ExpenseStatus.PROCESSED ? 'processed' : 'pending_review';
}

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function mapExpense(expense: Expense) {
  return {
    id: expense.id,
    amount: expense.amount == null ? null : Number(expense.amount),
    type: expense.type,
    description: expense.description,
    date: dateOnly(expense.date),
    paidByCompany: expense.paidByCompany,
    loaded: expense.loaded,
    fileUrl: expense.fileUrl,
    originalFileName: expense.originalFileName,
    mimeType: expense.mimeType,
    status: apiStatus(expense.status),
    source: expense.source === ExpenseSource.EMAIL ? 'email' : 'manual',
    extractionError: expense.extractionError,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}
