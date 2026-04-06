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
