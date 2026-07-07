import convertHeic = require('heic-convert');

const HEIC_EXTENSIONS = new Set(['heic', 'heif']);

export function isHeicFile(mimeType: string, fileName: string): boolean {
  const mime = (mimeType || '').toLowerCase();
  if (mime === 'image/heic' || mime === 'image/heif') return true;
  const ext = extensionOf(fileName);
  return HEIC_EXTENSIONS.has(ext);
}

export function heicFileNameToJpeg(fileName: string): string {
  const trimmed = String(fileName ?? '').trim() || 'receipt.heic';
  if (/\.heif$/i.test(trimmed)) return trimmed.replace(/\.heif$/i, '.jpg');
  if (/\.heic$/i.test(trimmed)) return trimmed.replace(/\.heic$/i, '.jpg');
  return `${trimmed.replace(/\.[^.]+$/, '') || 'receipt'}.jpg`;
}

export async function convertHeicBufferToJpeg(buffer: Buffer, quality = 0.92): Promise<Buffer> {
  const converted = await convertHeic({ buffer, format: 'JPEG', quality });
  return Buffer.from(converted);
}

function extensionOf(fileName: string): string {
  const parts = String(fileName ?? '').toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}
