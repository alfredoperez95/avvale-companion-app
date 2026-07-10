import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Expense, ExpenseStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseStorageService } from './expense-storage.service';
import { ExpenseAiService } from './expense-ai.service';
import { convertHeicBufferToJpeg, heicFileNameToJpeg, isHeicFile } from './expense-image.utils';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { SyncExpenseImportStatusDto } from './dto/sync-expense-import-status.dto';
import { isExpenseCategory } from './expense-categories';

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'pdf', 'heic']);
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

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ExpenseStorageService,
    private readonly ai: ExpenseAiService,
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

  private async runExtraction(userId: string, expense: Expense): Promise<Expense> {
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
          date: extracted.date ? new Date(extracted.date) : null,
          extractionError: null,
          rawModelOutput: extracted.rawModelOutput,
          modelId: extracted.modelId,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`No se pudo extraer recibo ${expense.id}: ${message}`);
      return this.prisma.expense.update({
        where: { id: expense.id },
        data: {
          extractionError: message,
          rawModelOutput: null,
          modelId: null,
        },
      });
    }
  }
}

function validateReceiptFile(file: Express.Multer.File): void {
  const ext = extensionOf(file.originalname);
  const mime = (file.mimetype || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_MIME_TYPES.has(mime)) {
    throw new BadRequestException('Formato no soportado. Usa JPG, JPEG, PNG, PDF o HEIC.');
  }
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
    extractionError: expense.extractionError,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}
