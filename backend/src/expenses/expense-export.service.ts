import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expense } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { resolveBackendPublicBaseUrl } from '../config/backend-public-base-url';
import { GenerateExpenseExportDto } from './dto/generate-expense-export.dto';
import { resolvePathWithinBase } from '../files/safe-path';

const EXPORT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_EXPORT_TTL_HOURS = 2;

type ExportReceipt = {
  expenseId: string;
  fileName: string;
  publicUrl: string;
  copied: boolean;
};

export type GeneratedExpenseExport = {
  csv: Buffer;
  fileName: string;
  expiresAt: Date;
};

export type ExpenseImportPayloadItem = {
  id: string;
  fecha: string;
  importe: number | string;
  tipo: string;
  descripcion: string;
  estado: 'processed';
  nombre_archivo: string;
  url_recibo: string;
  caduca_en: string;
  paid_by_company: boolean;
};

export type GeneratedExpenseImportPayload = {
  payload: {
    expenses: ExpenseImportPayloadItem[];
    meta: {
      source: 'companion-app';
      batchId: string;
    };
  };
  expiresAt: Date;
};

@Injectable()
export class ExpenseExportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExpenseExportService.name);
  private readonly baseDir: string;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.baseDir = this.config.get<string>('ATTACHMENTS_DIR') ?? path.join(process.cwd(), 'uploads');
  }

  onModuleInit() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredExports().catch((err) => {
        this.logger.warn(`No se pudieron limpiar exports de gastos caducados: ${errorText(err)}`);
      });
    }, EXPORT_CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  async generateExport(userId: string, dto: GenerateExpenseExportDto): Promise<GeneratedExpenseExport> {
    const prepared = await this.prepareMonthExport(userId, dto);
    const csv = buildCsv(prepared.expenses, prepared.receipts, prepared.expiresAt);
    return {
      csv,
      fileName: `gastos-${dto.year}-${String(dto.month).padStart(2, '0')}.csv`,
      expiresAt: prepared.expiresAt,
    };
  }

  async generateImportPayload(userId: string, dto: GenerateExpenseExportDto): Promise<GeneratedExpenseImportPayload> {
    const prepared = await this.prepareMonthExport(userId, dto);
    const processedExpenses = prepared.expenses.filter((expense) => expense.status === 'PROCESSED');
    if (!processedExpenses.length) {
      throw new BadRequestException('No hay gastos procesados para enviar a Avvale Time Report.');
    }

    const receiptByExpenseId = new Map(prepared.receipts.map((receipt) => [receipt.expenseId, receipt]));
    const missingReceipts = processedExpenses.filter((expense) => {
      const receipt = receiptByExpenseId.get(expense.id);
      return !receipt?.copied || !receipt.publicUrl || !receipt.fileName;
    });
    if (missingReceipts.length > 0) {
      throw new BadRequestException(
        `No se pudo preparar el recibo de ${missingReceipts.length} gasto(s) para enviar a Avvale Time Report. Revisa que el archivo del recibo siga disponible.`,
      );
    }

    return {
      payload: {
        expenses: processedExpenses.map((expense) => {
          const receipt = receiptByExpenseId.get(expense.id)!;
          return {
            id: expense.id,
            fecha: dateOnly(expense.date),
            importe: expense.amount == null ? '' : Number(expense.amount),
            tipo: expense.type ?? '',
            descripcion: expense.description ?? '',
            estado: 'processed',
            nombre_archivo: receipt.fileName,
            url_recibo: receipt.publicUrl,
            caduca_en: prepared.expiresAt.toISOString(),
            paid_by_company: expense.paidByCompany,
          };
        }),
        meta: {
          source: 'companion-app',
          batchId: prepared.token,
        },
      },
      expiresAt: prepared.expiresAt,
    };
  }

  private async prepareMonthExport(
    userId: string,
    dto: GenerateExpenseExportDto,
  ): Promise<{ token: string; expiresAt: Date; expenses: Expense[]; receipts: ExportReceipt[] }> {
    const expenseIds = [...new Set(dto.expenseIds)];
    const expenses = await this.prisma.expense.findMany({
      where: {
        id: { in: expenseIds },
        userId,
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    if (expenses.length !== expenseIds.length) {
      throw new BadRequestException('Alguno de los gastos seleccionados no existe o no pertenece al usuario.');
    }

    const monthExpenses = expenses.filter((expense) => isExpenseInMonth(expense, dto.year, dto.month));
    if (monthExpenses.length !== expenses.length) {
      throw new BadRequestException('Alguno de los gastos seleccionados no pertenece al mes exportado.');
    }

    const token = randomUUID();
    const relativeDir = path.join('expense-exports', token);
    const fullDir = resolvePathWithinBase(this.baseDir, relativeDir);
    const expiresAt = this.computeExpiresAt();
    await fs.mkdir(fullDir, { recursive: true });

    const publicBaseUrl = await resolveBackendPublicBaseUrl(this.config);
    const receipts = await Promise.all(
      monthExpenses.map((expense) => this.copyReceiptForExport(expense, fullDir, publicBaseUrl, token)),
    );

    await this.prisma.expenseMonthExport.create({
      data: {
        userId,
        year: dto.year,
        month: dto.month,
        token,
        storagePath: relativeDir.replace(/\\/g, '/'),
        expenseIds,
        expiresAt,
      },
    });

    return { token, expiresAt, expenses: monthExpenses, receipts };
  }

  async getPublicFile(token: string, fileName: string): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
    const exportRecord = await this.prisma.expenseMonthExport.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
      },
      select: {
        storagePath: true,
        expenseIds: true,
      },
    });
    if (!exportRecord) {
      throw new NotFoundException('Export de gastos no encontrado o expirado');
    }

    const safeName = sanitizeFileName(fileName);
    if (!safeName) {
      throw new NotFoundException('Archivo no encontrado');
    }
    const allowedExpenseIds = expenseIdsFromJson(exportRecord.expenseIds);
    if (!isExportFileAllowed(safeName, allowedExpenseIds)) {
      throw new NotFoundException('Archivo no encontrado');
    }

    try {
      const buffer = await fs.readFile(resolvePathWithinBase(this.baseDir, path.join(exportRecord.storagePath, safeName)));
      return {
        buffer,
        fileName: safeName,
        contentType: contentTypeForFileName(safeName),
      };
    } catch {
      throw new NotFoundException('Archivo no encontrado');
    }
  }

  async cleanupExpiredExports(): Promise<number> {
    const expired = await this.prisma.expenseMonthExport.findMany({
      where: { expiresAt: { lte: new Date() } },
      select: { id: true, storagePath: true },
    });

    for (const item of expired) {
      await fs.rm(resolvePathWithinBase(this.baseDir, item.storagePath), { recursive: true, force: true }).catch((err) => {
        this.logger.warn(`No se pudo borrar export de gastos ${item.id}: ${errorText(err)}`);
      });
    }

    if (expired.length > 0) {
      await this.prisma.expenseMonthExport.deleteMany({
        where: { id: { in: expired.map((item) => item.id) } },
      });
    }

    return expired.length;
  }

  private computeExpiresAt(): Date {
    const configured = Number(this.config.get<string>('EXPENSE_EXPORT_TTL_HOURS') ?? DEFAULT_EXPORT_TTL_HOURS);
    const ttlHours = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_EXPORT_TTL_HOURS;
    return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  }

  private async copyReceiptForExport(
    expense: Expense,
    fullDir: string,
    publicBaseUrl: string,
    token: string,
  ): Promise<ExportReceipt> {
    const relativeStorage = normalizeExpenseStoragePath(expense.storagePath);
    let detectedMime = String(expense.mimeType ?? '').trim();
    let fileName = buildExportReceiptFileName(expense);

    try {
      if (!relativeStorage) {
        throw new Error('storagePath vacío');
      }
      const source = resolvePathWithinBase(this.baseDir, relativeStorage);
      const buffer = await fs.readFile(source);
      if (looksLikePdf(buffer)) {
        detectedMime = 'application/pdf';
        fileName = buildExportReceiptFileName({
          id: expense.id,
          originalFileName: expense.originalFileName,
          mimeType: 'application/pdf',
        });
      }
      const target = path.join(fullDir, fileName);
      await fs.writeFile(target, buffer);
      const publicUrl = buildExpenseExportPublicUrl(publicBaseUrl, token, fileName);
      return {
        expenseId: expense.id,
        fileName,
        publicUrl,
        copied: true,
      };
    } catch (err) {
      this.logger.warn(
        `No se pudo copiar recibo ${expense.id} para export (mime=${detectedMime || 'n/a'}, file=${fileName}): ${errorText(err)}`,
      );
      return {
        expenseId: expense.id,
        fileName,
        publicUrl: '',
        copied: false,
      };
    }
  }
}

function isExpenseInMonth(expense: Expense, year: number, month: number): boolean {
  if (!expense.date) return false;
  return expense.date.getUTCFullYear() === year && expense.date.getUTCMonth() + 1 === month;
}

function buildCsv(expenses: Expense[], receipts: ExportReceipt[], expiresAt: Date): Buffer {
  const receiptByExpenseId = new Map(receipts.map((receipt) => [receipt.expenseId, receipt]));
  const rows = [
    [
      'id',
      'fecha',
      'importe',
      'tipo',
      'descripcion',
      'estado',
      'paid_by_company',
      'nombre_archivo',
      'url_recibo',
      'caduca_en',
    ],
    ...expenses.map((expense) => {
      const receipt = receiptByExpenseId.get(expense.id);
      return [
        expense.id,
        dateOnly(expense.date),
        expense.amount == null ? '' : String(Number(expense.amount)),
        expense.type ?? '',
        expense.description ?? '',
        expense.status === 'PROCESSED' ? 'processed' : 'pending_review',
        expense.paidByCompany ? 'true' : 'false',
        receipt?.copied ? receipt.fileName : '',
        receipt?.publicUrl ?? '',
        expiresAt.toISOString(),
      ];
    }),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
  return Buffer.from(`\uFEFF${csv}\r\n`, 'utf8');
}

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  const escaped = safe.replace(/"/g, '""');
  return /[;"\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function dateOnly(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : '';
}

function sanitizeFileName(fileName: string): string {
  const safe = path.basename(String(fileName ?? '')).replace(/[^\w.\- ()\[\]]+/g, '_');
  return safe.length > 220 ? safe.slice(0, 220) : safe;
}

/**
 * Nombre del recibo en el lote de export/import hacia la extensión.
 * Debe terminar en una extensión coherente con el MIME (p. ej. PDF → .pdf) para que
 * `url_recibo` sirva el Content-Type correcto y Expenses Import no trate el binario como imagen.
 */
export function buildExportReceiptFileName(expense: Pick<Expense, 'id' | 'originalFileName' | 'mimeType'>): string {
  const expenseId = String(expense.id ?? '').trim() || 'expense';
  const original = sanitizeFileName(expense.originalFileName);
  const mime = String(expense.mimeType ?? '')
    .trim()
    .toLowerCase();
  const originalLower = original.toLowerCase();
  const originalExt = path.extname(originalLower).replace(/^\./, '');

  const isPdf = isPdfMime(mime) || originalExt === 'pdf';
  if (isPdf) {
    const stem = stripFileExtension(original).replace(/\.+$/g, '').trim() || `recibo-${expenseId}`;
    return `${expenseId}_${stem}.pdf`;
  }

  const imageExt = imageExtensionFromMime(mime) ?? (IMAGE_EXTENSIONS.has(originalExt) ? normalizeImageExt(originalExt) : null);
  if (imageExt) {
    const stem = stripFileExtension(original).replace(/\.+$/g, '').trim() || `recibo-${expenseId}`;
    return `${expenseId}_${stem}.${imageExt}`;
  }

  if (original && originalExt) {
    return `${expenseId}_${original}`;
  }

  return `${expenseId}_${original || `recibo-${expenseId}`}`;
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);

export function isPdfMime(mime: string): boolean {
  const normalized = String(mime ?? '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    ?.trim();
  return normalized === 'application/pdf';
}

function looksLikePdf(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).toString('latin1') === '%PDF';
}

function normalizeExpenseStoragePath(storagePath: string): string {
  return String(storagePath ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
}

function buildExpenseExportPublicUrl(publicBaseUrl: string, token: string, fileName: string): string {
  const base = String(publicBaseUrl ?? '').trim().replace(/\/+$/, '');
  return `${base}/public/expense-exports/${token}/${encodeURIComponent(fileName)}`;
}

function imageExtensionFromMime(mime: string): string | null {
  const normalized = String(mime ?? '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    ?.trim();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/heic') return 'heic';
  if (normalized === 'image/heif') return 'heif';
  return null;
}

function normalizeImageExt(ext: string): string {
  return ext === 'jpeg' ? 'jpg' : ext;
}

function stripFileExtension(fileName: string): string {
  const ext = path.extname(fileName);
  if (!ext) return fileName;
  return fileName.slice(0, -ext.length);
}

function expenseIdsFromJson(raw: unknown): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0));
}

function isExportFileAllowed(fileName: string, expenseIds: Set<string>): boolean {
  if (expenseIds.size === 0) return false;
  return [...expenseIds].some((expenseId) => fileName.startsWith(`${expenseId}_`));
}

function contentTypeForFileName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.heic') return 'image/heic';
  if (ext === '.heif') return 'image/heif';
  return 'application/octet-stream';
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
