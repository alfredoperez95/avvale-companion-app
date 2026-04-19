/**
 * Valor de deal en euros: entrada solo dígitos (enteros), visualización es-ES con €.
 */

/** Límite práctico (precisión segura con Number al formatear). */
const MAX_DIGITS = 15;

/** Convierte lo guardado en API (número plano, texto con miles, "250.000 €", etc.) a cadena solo de dígitos (euros enteros). */
export function euroDigitsFromStored(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) return '';
  const t = String(raw).trim();
  if (/^\d+$/.test(t)) {
    return stripLeadingZeros(t.slice(0, MAX_DIGITS));
  }
  const noCurrency = t.replace(/[€\s\u00a0]/g, '');
  const normalized = noCurrency.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return '';
  const int = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(n + 1e-9));
  return String(int).slice(0, MAX_DIGITS);
}

function stripLeadingZeros(d: string): string {
  const s = d.replace(/^0+(?=\d)/, '');
  return s.slice(0, MAX_DIGITS);
}

/** Solo dígitos desde lo que escribe el usuario (pegar "25.000 €" → "25000"). */
export function sanitizeEuroDigitsFromInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return stripLeadingZeros(digits);
}

/** Texto mostrado en el input mientras se edita. */
export function formatEuroDigitsForDisplay(digits: string): string {
  if (!digits) return '';
  const n = Number(digits);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Valor a persistir: mismo formato legible (prompt IA / listados). */
export function euroDigitsToStored(digits: string): string {
  if (!digits) return '';
  return formatEuroDigitsForDisplay(digits);
}
