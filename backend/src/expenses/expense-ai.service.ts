import { BadRequestException, Injectable } from '@nestjs/common';
import { AnthropicCredentialsService } from '../ai-credentials/anthropic/anthropic-credentials.service';
import { AnthropicClientService } from '../yubiq/approve-seal-filler/anthropic-client.service';
import { PdfExtractionService } from '../yubiq/approve-seal-filler/pdf-extraction.service';
import { recoverJsonObjectString, safeJsonParse } from '../rfq-analysis/rfq-analysis.utils';
import { convertHeicBufferToJpeg } from './expense-image.utils';
import { EXPENSE_CATEGORIES, ExpenseCategory, isExpenseCategory } from './expense-categories';

export type ExpenseExtraction = {
  amount: number | null;
  type: ExpenseCategory | null;
  description: string | null;
  date: string | null;
  rawModelOutput: string | null;
  modelId: string | null;
};

type RawExpenseExtraction = {
  amount?: unknown;
  receiptAmounts?: unknown;
  expenseType?: unknown;
  description?: unknown;
  date?: unknown;
};

const IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png']);
const MIN_USABLE_PDF_TEXT_CHARS = 40;
const MAX_PDF_VISION_PAGES = 10;

@Injectable()
export class ExpenseAiService {
  constructor(
    private readonly creds: AnthropicCredentialsService,
    private readonly anthropic: AnthropicClientService,
    private readonly pdf: PdfExtractionService,
  ) {}

  async extract(userId: string, file: { buffer: Buffer; fileName: string; mimeType: string }): Promise<ExpenseExtraction> {
    const apiKey = await this.creds.getApiKeyPlainOrThrow(userId);
    const prompt = buildExpensePrompt(file.fileName);
    const normalizedMime = normalizeMimeType(file.mimeType, file.fileName);

    if (normalizedMime === 'application/pdf') {
      return this.extractFromPdf(apiKey, file.buffer, prompt);
    }

    const image = await toAnthropicImage(file.buffer, normalizedMime);
    const { text, modelId } = await this.anthropic.extractJsonFromImage({
      apiKey,
      model: 'haiku',
      prompt,
      imageBase64: image.buffer.toString('base64'),
      mediaType: image.mediaType,
      maxTokens: 1200,
    });
    return parseExtraction(text, modelId);
  }

  private async extractFromPdf(apiKey: string, buffer: Buffer, prompt: string): Promise<ExpenseExtraction> {
    const extractedText = await this.pdf.extractTextFromPdfBuffer(buffer);
    if (hasUsablePdfText(extractedText)) {
      const { text, modelId } = await this.anthropic.extractJson({
        apiKey,
        model: 'haiku',
        prompt: `${prompt}\n\nTexto extraído del PDF:\n${extractedText.slice(0, 50_000)}`,
        maxTokens: 1200,
      });
      return parseExtraction(text, modelId);
    }

    const pages = await this.pdf.renderPagesAsPngBuffers(buffer, {
      scale: 1,
      maxPages: MAX_PDF_VISION_PAGES,
    });
    if (!pages.length) {
      throw new BadRequestException(
        'No se pudo leer texto ni renderizar páginas del PDF. Sube una imagen del recibo o reintenta con otro archivo.',
      );
    }

    const { text, modelId } = await this.anthropic.extractJsonFromImages({
      apiKey,
      model: 'haiku',
      prompt: `${prompt}\n\nEl PDF tiene ${pages.length} página(s) escaneada(s). Cada imagen es una página del documento; puede haber uno o varios tickets.`,
      images: pages.map((page) => ({
        imageBase64: page.buffer.toString('base64'),
        mediaType: 'image/png' as const,
      })),
      maxTokens: 1600,
    });
    return parseExtraction(text, modelId);
  }
}

export function buildExpensePrompt(fileName: string): string {
  return `You are extracting fields from an expense receipt for an enterprise expense process.

Return ONLY a valid JSON object with exactly these keys:
{
  "amount": number | null,
  "receiptAmounts": number[] | null,
  "expenseType": string | null,
  "description": string | null,
  "date": "YYYY-MM-DD" | null
}

Rules:
- The document may contain MULTIPLE receipts/tickets (several pages, or several tickets in one file).
- For each distinct receipt, extract only its final total amount paid. Do not extract subtotal, tax/IVA, tip, change, card digits, or "total por persona".
- Put each receipt's final total in "receiptAmounts" (one number per receipt, in document order).
- Set "amount" to the SUM of all values in "receiptAmounts" (consolidated global total for the expense).
- If there is only one receipt, "receiptAmounts" may be [amount] or null, and "amount" is that receipt total.
- The expenseType MUST be exactly one of these categories: ${EXPENSE_CATEGORIES.map((c) => `"${c}"`).join(', ')}.
- If no category is clearly supported, choose the closest category from the list.
- The description must summarize what the attached document is for, based only on the receipt/invoice/proforma content.
- When consolidating multiple receipts, mention how many tickets and the supplier/place when known (e.g. "4 tickets en La Cantina de Fredy's").
- For travel documents, include the relevant traveler/guest name, service, destination/hotel/place and supplier when present.
- Keep description concise, in Spanish, one sentence, max 180 characters.
- Do not copy email threads, signatures, disclaimers, URLs, QR references, contact blocks, legal notices, or raw OCR noise.
- If the document content is too unclear to describe the expense, return null for description.
- The date must be the receipt date in YYYY-MM-DD format. If receipts span multiple days, use the most recent date.
- If a field cannot be read, return null for that field.
- Do not include currency or any explanation.

File name: ${fileName}`;
}

export function parseExtraction(rawText: string, modelId: string): ExpenseExtraction {
  const recoveredJson = recoverJsonObjectString(rawText);
  const parsed = safeJsonParse(recoveredJson) as RawExpenseExtraction | null;
  if (!parsed || typeof parsed !== 'object') {
    throw new BadRequestException('La IA no devolvió JSON válido');
  }

  const receiptAmounts = normalizeAmountList(parsed.receiptAmounts);
  const summedAmount =
    receiptAmounts && receiptAmounts.length > 0
      ? Math.round(receiptAmounts.reduce((sum, value) => sum + value, 0) * 100) / 100
      : null;

  return {
    amount: summedAmount ?? normalizeAmount(parsed.amount),
    type: normalizeType(parsed.expenseType),
    description: normalizeDescription(parsed.description),
    date: normalizeDate(parsed.date),
    rawModelOutput: recoveredJson || rawText,
    modelId,
  };
}

export function hasUsablePdfText(text: string): boolean {
  const cleaned = String(text ?? '')
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length >= MIN_USABLE_PDF_TEXT_CHARS;
}

function normalizeAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/[^\d,.\-]/g, '');
  if (!cleaned) return null;
  const normalized =
    cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function normalizeAmountList(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const amounts = value
    .map((item) => normalizeAmount(item))
    .filter((item): item is number => item != null && item > 0);
  return amounts.length > 0 ? amounts : null;
}

function normalizeType(value: unknown): ExpenseCategory | null {
  if (isExpenseCategory(value)) return value;
  if (typeof value !== 'string') return null;
  const lower = value.trim().toLowerCase();
  return EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === lower) ?? null;
}

function normalizeDescription(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  if (!normalized) return null;
  return normalized.length > 180 ? normalized.slice(0, 177).trimEnd() + '...' : normalized;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : trimmed;
}

function normalizeMimeType(mimeType: string, fileName: string): string {
  const lower = (mimeType || '').toLowerCase();
  const name = fileName.toLowerCase();
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic';
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (lower === 'image/jpg') return 'image/jpeg';
  if (lower) return lower;
  return 'application/octet-stream';
}

async function toAnthropicImage(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mediaType: 'image/jpeg' | 'image/png' }> {
  if (IMAGE_MEDIA_TYPES.has(mimeType)) {
    return { buffer, mediaType: mimeType as 'image/jpeg' | 'image/png' };
  }
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    try {
      const converted = await convertHeicBufferToJpeg(buffer);
      return { buffer: converted, mediaType: 'image/jpeg' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(
        `El recibo HEIC no se pudo convertir para procesarlo con IA. Detalle: ${message}`,
      );
    }
  }
  throw new BadRequestException('Formato de imagen no soportado para extracción');
}
