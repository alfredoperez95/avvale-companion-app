/**
 * Etiqueta corta para tablas: solo el código (p. ej. ESP_26_0252) antes del primer " - ".
 * Los datos siguen llevando el valor completo; esto es solo presentación.
 */
export function offerCodeShortLabel(full: string): { short: string; fullTitle?: string } {
  const trimmed = full.trim();
  if (!trimmed) {
    return { short: '—' };
  }
  const sep = ' - ';
  const i = trimmed.indexOf(sep);
  if (i === -1) {
    return { short: trimmed };
  }
  const short = trimmed.slice(0, i).trim();
  return {
    short: short || '—',
    fullTitle: trimmed,
  };
}
