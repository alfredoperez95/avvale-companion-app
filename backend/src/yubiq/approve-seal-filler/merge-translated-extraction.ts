import type { ClaudeOfferExtraction } from './offer-extraction.types';

function pickStr(t: unknown, fallback: string): string {
  return typeof t === 'string' ? t : fallback;
}

function pickOptStr(t: unknown, fallback: string | null | undefined): string | null | undefined {
  if (t === undefined) return fallback;
  return typeof t === 'string' ? t : fallback;
}

function optStrNoNull(v: string | null | undefined): string | undefined {
  return v == null || v === '' ? undefined : v;
}

/**
 * Aplica la salida del modelo sobre la extracción original, preservando siempre
 * enums, confidence y campos numéricos de la original (anti-alucinación).
 */
export function mergeTranslatedExtraction(
  original: ClaudeOfferExtraction,
  parsed: Record<string, unknown>,
): ClaudeOfferExtraction {
  return {
    ...original,
    titulo: pickStr(parsed.titulo, original.titulo),
    nombreCliente: pickStr(parsed.nombreCliente, original.nombreCliente),
    importeOferta: pickStr(parsed.importeOferta, original.importeOferta),
    resumen: pickStr(parsed.resumen, original.resumen),
    observaciones: pickStr(parsed.observaciones, original.observaciones),
    notaInterpretacionImporte: optStrNoNull(
      pickOptStr(parsed.notaInterpretacionImporte, original.notaInterpretacionImporte),
    ),
    notaMultiplesOpcionesPrecio: pickOptStr(
      parsed.notaMultiplesOpcionesPrecio,
      original.notaMultiplesOpcionesPrecio,
    ) as string | undefined,
    notaImporteCompromiso: pickOptStr(parsed.notaImporteCompromiso, original.notaImporteCompromiso),
    importeTotalConCompromisoTexto: pickOptStr(
      parsed.importeTotalConCompromisoTexto,
      original.importeTotalConCompromisoTexto,
    ),
    areaCompania: original.areaCompania,
    confidence: original.confidence,
    importeRevenueTmSinJornadasNumerico: original.importeRevenueTmSinJornadasNumerico,
    importeTotalConCompromisoNumerico: original.importeTotalConCompromisoNumerico,
    numeroOpcionesPrecioEstimado: original.numeroOpcionesPrecioEstimado,
    dealType: original.dealType,
    areaAvvale: original.areaAvvale,
  };
}
