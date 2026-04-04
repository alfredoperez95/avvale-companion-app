/** Ver docs/YUBIQ_OFERTA_REGLAS.md (tabla de constantes). */
/**
 * Texto mostrado cuando la oferta describe varias opciones o rangos de precio.
 * El importe consolidado usa el escenario de mayor importe (evaluación conservadora / más positiva en valor ofertado).
 */
export const NOTA_MULTIPLES_OPCIONES_PRECIO_BASE =
  'La oferta describe varias opciones o rangos de precio (no solo dos). Para el importe mostrado y la evaluación económica se ha considerado el escenario más positivo: el de mayor importe entre las alternativas identificables.';

export function buildNotaMultiplesOpcionesPrecio(numeroOpcionesEstimado: number | null | undefined): string {
  const base = NOTA_MULTIPLES_OPCIONES_PRECIO_BASE;
  if (numeroOpcionesEstimado != null && numeroOpcionesEstimado >= 2) {
    return `${base} Opciones o modalidades de precio contrastables identificadas: aproximadamente ${numeroOpcionesEstimado}.`;
  }
  return base;
}
