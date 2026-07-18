import { BadRequestException } from '@nestjs/common';
import * as path from 'path';
import { randomUUID } from 'crypto';

export type UploadContext = 'activation' | 'avatar' | 'expense' | 'rfq' | 'meddpicc' | 'yubiq';

export type SafeFile = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string | null;
  size?: number | null;
};

export type SafeFileMetadata = {
  buffer: Buffer;
  displayName: string;
  storedFileName: string;
  contentType: string;
  extension: string;
};

type FileRule = {
  maxBytes: number;
  allowedExtensions: Set<string>;
  label: string;
};

const MiB = 1024 * 1024;

const DANGEROUS_EXTENSIONS = new Set([
  'svg',
  'html',
  'htm',
  'js',
  'mjs',
  'cjs',
  'php',
  'phtml',
  'exe',
  'dll',
  'bat',
  'cmd',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'jar',
  'com',
  'scr',
  'msi',
  'vbs',
  'wsf',
  'hta',
]);

const DANGEROUS_MIME_PREFIXES = ['text/html', 'image/svg+xml', 'application/javascript', 'text/javascript'];

const RULES: Record<UploadContext, FileRule> = {
  avatar: {
    maxBytes: 2 * MiB,
    allowedExtensions: new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']),
    label: 'JPEG, PNG, WebP o GIF',
  },
  expense: {
    maxBytes: 20 * MiB,
    allowedExtensions: new Set(['jpg', 'jpeg', 'png', 'pdf', 'heic', 'heif']),
    label: 'JPG, PNG, PDF o HEIC',
  },
  yubiq: {
    maxBytes: 20 * MiB,
    allowedExtensions: new Set(['pdf']),
    label: 'PDF',
  },
  activation: {
    maxBytes: 20 * MiB,
    allowedExtensions: new Set([
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
    ]),
    label: 'PDF, Office, imagen raster, TXT, CSV o ZIP',
  },
  rfq: {
    maxBytes: 50 * MiB,
    allowedExtensions: new Set(['pdf', 'docx', 'xlsx', 'xls', 'txt', 'md', 'csv', 'json', 'xml', 'log']),
    label: 'PDF, Office, TXT, Markdown, CSV, JSON, XML o LOG',
  },
  meddpicc: {
    maxBytes: 25 * MiB,
    allowedExtensions: new Set(['pdf', 'docx', 'xlsx', 'xls', 'eml']),
    label: 'PDF, Excel, Word .docx o EML',
  },
};

const CANONICAL_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  log: 'text/plain',
  zip: 'application/zip',
  eml: 'message/rfc822',
};

function extensionParts(fileName: string): string[] {
  return path
    .basename(fileName || '')
    .split('.')
    .slice(1)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function extensionOf(fileName: string): string {
  const parts = extensionParts(fileName);
  return parts.at(-1) ?? '';
}

function sanitizeDisplayName(name: string, extension: string): string {
  const fallback = `documento.${extension}`;
  const base = path.basename(name || fallback);
  const withoutExt = base.replace(/\.[^.]*$/, '') || 'documento';
  const cleaned = withoutExt
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^\w.\- ()[\]]+/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^[-_. ]+|[-_. ]+$/g, '')
    .slice(0, 120);
  return `${cleaned || 'documento'}.${extension}`;
}

function startsWithAscii(buffer: Buffer, value: string): boolean {
  return buffer.subarray(0, value.length).toString('ascii') === value;
}

function detectKind(buffer: Buffer): string | null {
  if (buffer.length >= 4 && startsWithAscii(buffer, '%PDF')) return 'pdf';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.length >= 6 && (startsWithAscii(buffer, 'GIF87a') || startsWithAscii(buffer, 'GIF89a'))) return 'gif';
  if (buffer.length >= 12 && startsWithAscii(buffer, 'RIFF') && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
    if (brand.startsWith('hei') || brand.startsWith('mif')) return 'heic';
  }
  if (buffer.length >= 2 && startsWithAscii(buffer, 'MZ')) return 'exe';
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  ) {
    return 'ole';
  }
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)) return 'zip';
  if (buffer.length >= 5 && startsWithAscii(buffer, 'From ')) return 'eml';
  return null;
}

function looksLikeText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  if (sample.includes(0)) return false;
  const text = sample.toString('utf8');
  return !text.includes('\uFFFD');
}

function assertNoDangerousContent(buffer: Buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8').toLowerCase();
  if (/<\s*(script|html|svg|iframe|object|embed|body|head)\b/.test(sample) || /<\?php\b/.test(sample)) {
    throw new BadRequestException('Archivo bloqueado: contiene HTML, SVG, script o PHP.');
  }
}

function assertPdfLooksWellFormed(buffer: Buffer) {
  if (buffer.length < 32 || !startsWithAscii(buffer, '%PDF-')) {
    throw new BadRequestException('PDF no válido o malformado.');
  }
  const tail = buffer.subarray(Math.max(0, buffer.length - 2048)).toString('latin1');
  if (!tail.includes('%%EOF')) {
    throw new BadRequestException('PDF no válido o incompleto.');
  }
}

function assertImageLooksWellFormed(buffer: Buffer, extension: string) {
  if ((extension === 'jpg' || extension === 'jpeg') && !(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9)) {
    throw new BadRequestException('Imagen JPEG no válida o incompleta.');
  }
  if (extension === 'png' && buffer.length < 24) {
    throw new BadRequestException('Imagen PNG no válida o incompleta.');
  }
  if (extension === 'gif' && buffer.length < 10) {
    throw new BadRequestException('Imagen GIF no válida o incompleta.');
  }
  if (extension === 'webp' && buffer.length < 16) {
    throw new BadRequestException('Imagen WebP no válida o incompleta.');
  }
}

function assertMimeCompatible(extension: string, detected: string | null, declaredMime: string) {
  if (!declaredMime || declaredMime === 'application/octet-stream') return;
  if (DANGEROUS_MIME_PREFIXES.some((prefix) => declaredMime.startsWith(prefix))) {
    throw new BadRequestException('Tipo MIME no permitido.');
  }
  const canonical = CANONICAL_MIME[extension];
  if (!canonical) return;
  if (declaredMime === canonical) return;
  if (extension === 'jpg' || extension === 'jpeg') {
    if (declaredMime === 'image/jpg') return;
  }
  if (extension === 'csv' && (declaredMime === 'application/csv' || declaredMime === 'application/vnd.ms-excel')) return;
  if (extension === 'txt' || extension === 'md' || extension === 'log' || extension === 'json' || extension === 'xml') {
    if (declaredMime.startsWith('text/') || declaredMime === 'application/json' || declaredMime === 'application/xml') return;
  }
  if (['docx', 'xlsx', 'pptx', 'zip'].includes(extension) && detected === 'zip') return;
  if (extension === 'eml' && (declaredMime === 'application/vnd.ms-outlook' || declaredMime === 'message/rfc822')) return;
  throw new BadRequestException('El MIME declarado no coincide con el tipo permitido para la extensión.');
}

export function validateSafeFile(context: UploadContext, file: SafeFile): SafeFileMetadata {
  const rule = RULES[context];
  if (!file.buffer?.length) throw new BadRequestException('Falta el archivo');
  const size = file.size ?? file.buffer.length;
  if (size > rule.maxBytes || file.buffer.length > rule.maxBytes) {
    throw new BadRequestException(`Archivo demasiado grande. Máximo ${Math.floor(rule.maxBytes / MiB)} MB.`);
  }

  const ext = extensionOf(file.originalname);
  if (!ext) throw new BadRequestException(`Formato no permitido. Usa ${rule.label}.`);
  const parts = extensionParts(file.originalname);
  if (parts.some((part) => DANGEROUS_EXTENSIONS.has(part))) {
    throw new BadRequestException('Extensión de archivo bloqueada por seguridad.');
  }
  if (!rule.allowedExtensions.has(ext)) {
    throw new BadRequestException(`Formato no permitido. Usa ${rule.label}.`);
  }

  const detected = detectKind(file.buffer);
  if (detected === 'exe') {
    throw new BadRequestException('Archivo ejecutable bloqueado por seguridad.');
  }
  const declaredMime = (file.mimetype ?? '').split(';')[0].trim().toLowerCase();
  if (['txt', 'md', 'csv', 'json', 'xml', 'log'].includes(ext) || detected == null) {
    assertNoDangerousContent(file.buffer);
  }
  assertMimeCompatible(ext, detected, declaredMime);

  if (ext === 'pdf') assertPdfLooksWellFormed(file.buffer);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) assertImageLooksWellFormed(file.buffer, ext);

  if (['jpg', 'jpeg'].includes(ext) && detected !== 'jpeg') throw new BadRequestException('La imagen no coincide con la extensión declarada.');
  if (['png', 'gif', 'webp', 'heic', 'heif', 'pdf'].includes(ext) && detected !== ext && !(ext === 'heif' && detected === 'heic')) {
    throw new BadRequestException('El contenido real no coincide con la extensión declarada.');
  }
  if (['doc', 'xls', 'ppt'].includes(ext) && detected !== 'ole') {
    throw new BadRequestException('El archivo Office antiguo no tiene una estructura válida.');
  }
  if (['docx', 'xlsx', 'pptx', 'zip'].includes(ext) && detected !== 'zip') {
    throw new BadRequestException('El archivo Office/ZIP no tiene una estructura válida.');
  }
  if (['txt', 'md', 'csv', 'json', 'xml', 'log'].includes(ext) && !looksLikeText(file.buffer)) {
    throw new BadRequestException('El archivo de texto no es válido.');
  }

  const extension = ext === 'jpeg' ? 'jpg' : ext;
  const displayName = sanitizeDisplayName(file.originalname, extension);
  const contentType = CANONICAL_MIME[extension] ?? 'application/octet-stream';
  return {
    buffer: file.buffer,
    displayName,
    storedFileName: `${randomUUID()}.${extension}`,
    contentType,
    extension,
  };
}
