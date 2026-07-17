import { BadRequestException } from '@nestjs/common';

/** Adjuntos típicos de activaciones (ofimática + imágenes + PDF). */
const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'txt',
  'csv',
  'zip',
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream', // algunos clientes envían esto; la extensión decide
]);

function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  if (i < 0) return '';
  return fileName.slice(i + 1).toLowerCase();
}

export function validateActivationAttachmentFile(file: {
  originalname: string;
  mimetype: string;
}): void {
  const ext = extensionOf(file.originalname || '');
  const mime = (file.mimetype || '').toLowerCase();

  const extOk = ALLOWED_EXTENSIONS.has(ext);
  const mimeOk = ALLOWED_MIME_TYPES.has(mime);

  if (extOk && (mimeOk || mime === 'application/octet-stream' || !mime)) {
    return;
  }
  if (extOk && mimeOk) return;

  // Extensión válida prima sobre MIME raro de algunos OS/navegadores.
  if (extOk) return;

  throw new BadRequestException(
    'Formato de adjunto no permitido. Usa PDF, Office (doc/xls/ppt), imagen, TXT, CSV o ZIP.',
  );
}
