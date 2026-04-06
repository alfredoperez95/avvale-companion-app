import * as path from 'path';

/**
 * Extensiones → MIME para fallback cuando el webhook no envía tipo (Make legacy u omitidos).
 * Alineado con rutas de extracción en RfqPipelineService (PDF, texto, hojas, Office conocido).
 */
const EXTENSION_TO_MIME: Readonly<Record<string, string>> = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.text': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.log': 'text/plain',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
};

/**
 * Toma la parte principal de un Content-Type (sin parámetros charset, etc.) y la normaliza.
 * Devuelve null si viene vacío o no parece un MIME razonable.
 */
export function normalizeMimeString(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  const main = t.split(';')[0].trim();
  if (!main.includes('/')) return null;
  if (main.length > 255) return null;
  return main.toLowerCase();
}

export function guessMimeFromFileName(fileName: string): string | null {
  const ext = path.extname(fileName || '').toLowerCase();
  if (!ext) return null;
  return EXTENSION_TO_MIME[ext] ?? null;
}

/**
 * Resuelve el MIME para un adjunto del webhook RFQ email.
 * Prioridad: contentType (Make explícito) → mimeType (compatibilidad) → extensión → octet-stream.
 */
export function resolveRfqInboundAttachmentMime(input: {
  contentType?: string | null;
  mimeType?: string | null;
  fileName: string;
}): string {
  const fromContentType = normalizeMimeString(input.contentType ?? undefined);
  if (fromContentType) return fromContentType;

  const fromMimeType = normalizeMimeString(input.mimeType ?? undefined);
  if (fromMimeType) return fromMimeType;

  const fromExt = guessMimeFromFileName(input.fileName);
  if (fromExt) return fromExt;

  return 'application/octet-stream';
}
