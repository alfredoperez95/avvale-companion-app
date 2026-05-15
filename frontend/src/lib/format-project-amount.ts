/**
 * Formato visual de importes de proyecto (es-ES, EUR).
 * Acepta texto libre: "84000", "84.000", "84.000,50 €", etc.
 */

export function parseProjectAmountToNumber(raw: string): number | null {
  if (!raw?.trim()) return null;
  let s = raw
    .trim()
    .replace(/\u00a0/g, '')
    .replace(/\s/g, '')
    .replace(/€/g, '');
  if (!s) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    s = s.replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length > 2) {
      s = parts.join('');
    } else if (
      parts.length === 2 &&
      parts[1].length === 3 &&
      /^\d+$/.test(parts[0]) &&
      /^\d{3}$/.test(parts[1])
    ) {
      s = parts[0] + parts[1];
    }
  }

  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function formatEuroEsFixed2(n: number): string {
  if (!Number.isFinite(n)) return '';
  const negative = n < 0;
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split('.');
  const intStr = parts[0] ?? '0';
  const frac = parts[1] ?? '00';
  const grouped = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const num = `${grouped},${frac}`;
  return negative ? `-${num}` : num;
}

/** Ej.: "84000" → "84.000,00 €" */
export function formatProjectAmountDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const n = parseProjectAmountToNumber(trimmed);
  if (n === null) return trimmed;
  return `${formatEuroEsFixed2(n)} €`;
}
