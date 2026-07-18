export type UploadKind = 'activation' | 'avatar' | 'expense' | 'rfq' | 'meddpicc' | 'yubiq';

type Rule = {
  maxBytes: number;
  maxFiles?: number;
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
  'ps1',
  'jar',
  'com',
  'scr',
  'msi',
  'vbs',
  'wsf',
  'hta',
]);

export const UPLOAD_RULES: Record<UploadKind, Rule> = {
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
    label: 'PDF, Office, imagen, TXT, CSV o ZIP',
  },
  rfq: {
    maxBytes: 50 * MiB,
    maxFiles: 10,
    allowedExtensions: new Set(['pdf', 'docx', 'xlsx', 'xls', 'txt', 'md', 'csv', 'json', 'xml', 'log']),
    label: 'PDF, Office, TXT, Markdown, CSV, JSON, XML o LOG',
  },
  meddpicc: {
    maxBytes: 25 * MiB,
    maxFiles: 25,
    allowedExtensions: new Set(['pdf', 'docx', 'xlsx', 'xls', 'eml']),
    label: 'PDF, Excel, Word .docx o EML',
  },
};

export function uploadAccept(kind: UploadKind): string {
  return [...UPLOAD_RULES[kind].allowedExtensions].map((ext) => `.${ext}`).join(',');
}

export function formatUploadBytes(bytes: number): string {
  return `${(bytes / MiB).toFixed(bytes % MiB === 0 ? 0 : 1)} MB`;
}

function extensionParts(fileName: string): string[] {
  return fileName
    .toLowerCase()
    .split('.')
    .slice(1)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function validateUploadFile(kind: UploadKind, file: File): string | null {
  const rule = UPLOAD_RULES[kind];
  const parts = extensionParts(file.name);
  const ext = parts.at(-1) ?? '';
  if (!ext || !rule.allowedExtensions.has(ext)) {
    return `${file.name}: formato no permitido. Usa ${rule.label}.`;
  }
  if (parts.some((part) => DANGEROUS_EXTENSIONS.has(part))) {
    return `${file.name}: extensión bloqueada por seguridad.`;
  }
  if (file.size > rule.maxBytes) {
    return `${file.name}: supera el tamaño máximo (${formatUploadBytes(rule.maxBytes)}).`;
  }
  if (file.type === 'image/svg+xml' || file.type === 'text/html' || file.type.includes('javascript')) {
    return `${file.name}: tipo de archivo bloqueado por seguridad.`;
  }
  return null;
}

export function validateUploadFiles(kind: UploadKind, files: File[], existingCount = 0): string | null {
  const rule = UPLOAD_RULES[kind];
  if (rule.maxFiles != null && existingCount + files.length > rule.maxFiles) {
    return `Máximo ${rule.maxFiles} archivos.`;
  }
  for (const file of files) {
    const error = validateUploadFile(kind, file);
    if (error) return error;
  }
  return null;
}
