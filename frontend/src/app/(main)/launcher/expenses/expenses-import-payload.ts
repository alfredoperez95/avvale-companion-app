export type ExpensesImportExpenseRow = {
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

export type ExpensesImportPayload = {
  expenses: ExpensesImportExpenseRow[];
  meta?: {
    source?: string;
    batchId?: string;
  };
};

type LocalExpenseRef = {
  id: string;
  originalFileName?: string | null;
  mimeType?: string | null;
};

/** Normaliza recibos del payload antes del evento hacia la extensión (PDF con .pdf + URL http(s) absoluta). */
export function normalizeExpensesImportPayload(
  payload: ExpensesImportPayload,
  localExpenses: LocalExpenseRef[] = [],
  origin: string = typeof window !== 'undefined' ? window.location.origin : '',
): ExpensesImportPayload {
  const localById = new Map(localExpenses.map((expense) => [expense.id, expense]));
  const batchId = typeof payload.meta?.batchId === 'string' ? payload.meta.batchId.trim() : '';

  return {
    ...payload,
    expenses: payload.expenses.map((row) => {
      const local = localById.get(row.id);
      const backendFileName = String(row.nombre_archivo ?? '').trim();
      const nombreArchivo = normalizeReceiptFileNameForImport({
        id: row.id,
        nombreArchivo: backendFileName,
        originalFileName: local?.originalFileName,
        mimeType: local?.mimeType,
      });
      const urlRecibo = normalizeReceiptUrlForImport({
        url: row.url_recibo,
        batchId,
        exportFileName: backendFileName || nombreArchivo,
        origin,
      });
      return {
        ...row,
        nombre_archivo: nombreArchivo,
        url_recibo: urlRecibo,
      };
    }),
  };
}

export function isHttpUrl(value: string, origin: string = typeof window !== 'undefined' ? window.location.origin : ''): boolean {
  return Boolean(toAbsoluteHttpUrl(value, origin));
}

function normalizeReceiptFileNameForImport(input: {
  id: string;
  nombreArchivo?: string | null;
  originalFileName?: string | null;
  mimeType?: string | null;
}): string {
  const raw = String(input.nombreArchivo ?? '').trim() || String(input.originalFileName ?? '').trim();
  const mime = String(input.mimeType ?? '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    ?.trim();
  const isPdf =
    mime === 'application/pdf' ||
    /\.pdf$/i.test(raw) ||
    /\.pdf$/i.test(String(input.originalFileName ?? ''));

  if (isPdf) {
    const stem = stripFileExtension(raw)
      .replace(/[^\w.\- ()[\]]+/g, '_')
      .replace(/\.+$/g, '')
      .trim();
    const safeStem = stem || `recibo-${input.id}`;
    return `${safeStem}.pdf`;
  }

  if (raw) return raw;
  return `recibo-${input.id}`;
}

function normalizeReceiptUrlForImport(input: {
  url: string;
  batchId: string;
  exportFileName: string;
  origin: string;
}): string {
  const trimmed = String(input.url ?? '').trim();
  if (trimmed) {
    const absolute = toAbsoluteHttpUrl(trimmed, input.origin);
    if (absolute) {
      const rewritten = rewriteExpenseExportUrlToSameOrigin(absolute, input.origin);
      if (rewritten) return rewritten;
      return absolute;
    }
  }

  if (input.origin && input.batchId && input.exportFileName) {
    return `${input.origin}/api/public/expense-exports/${input.batchId}/${encodeURIComponent(input.exportFileName)}`;
  }
  return '';
}

function rewriteExpenseExportUrlToSameOrigin(url: string, origin: string): string | null {
  if (!origin) return null;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/(?:api\/)?public\/expense-exports\/([^/]+)\/([^/]+)$/);
    if (!match) return null;
    const token = match[1];
    const fileName = match[2];
    return `${origin}/api/public/expense-exports/${token}/${fileName}`;
  } catch {
    return null;
  }
}

function toAbsoluteHttpUrl(value: string, origin: string): string | null {
  try {
    const parsed = new URL(value, origin || undefined);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function stripFileExtension(fileName: string): string {
  const trimmed = String(fileName ?? '').trim();
  const idx = trimmed.lastIndexOf('.');
  if (idx <= 0) return trimmed;
  return trimmed.slice(0, idx);
}
