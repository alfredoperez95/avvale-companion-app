/**
 * Convierte el texto del usuario (p. ej. "15 %", "34,1") en un entero 0–100.
 * - Quita % y espacios; admite coma decimal europea.
 * - Acota al rango [0, 100] (valores fuera se ajustan al límite).
 * - Redondea al entero más cercano (34,1 → 34; 35,8 → 36; 67,4 → 67).
 * Si no hay número válido, devuelve undefined.
 */
export function parseManualMarginToNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;

  let withoutPercent = trimmed.replace(/%/g, '').replace(/\s/g, '');
  if (withoutPercent === '') return undefined;

  let normalized: string;
  if (/^\d+,\d+$/.test(withoutPercent)) {
    normalized = withoutPercent.replace(',', '.');
  } else {
    normalized = withoutPercent.replace(/,/g, '');
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return undefined;

  const clamped = Math.min(100, Math.max(0, parsed));
  return Math.round(clamped);
}
