export function recoverJsonObjectString(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  try {
    JSON.parse(s);
    return s;
  } catch {
    // intentar rescatar el primer {...} completo
  }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return s.slice(first, last + 1);
  }
  return s;
}

export function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function truncateForContext(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[… texto truncado por límite de contexto …]`;
}

/** Para logs de límites de tamaño (adjuntos RFQ, etc.). */
export function formatBytesHuman(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}
