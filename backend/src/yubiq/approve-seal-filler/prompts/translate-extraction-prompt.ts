/**
 * Traduce al inglés los textos de una extracción ya normalizada (misma forma que devuelve /analyze).
 */
export function buildTranslateExtractionPrompt(serializedExtraction: string): string {
  return `You translate business-offer extraction JSON from Spanish to English.

INPUT_JSON:
${serializedExtraction}

Output rules (strict):
- Reply with ONE JSON object only. No markdown fences, no commentary.
- Copy unchanged (do not translate, same value as input): areaCompania, confidence, importeRevenueTmSinJornadasNumerico, importeTotalConCompromisoNumerico, numeroOpcionesPrecioEstimado, dealType, areaAvvale.
- Translate to clear English: titulo, nombreCliente, resumen, observaciones.
- For importeOferta, importeTotalConCompromisoTexto: keep every digit, decimal/thousand separators, spaces, and € or EUR symbols exactly as in the input; only translate if there are words mixed in (rare).
- Translate optional note strings if present: notaInterpretacionImporte, notaMultiplesOpcionesPrecio, notaImporteCompromiso (keep numbers and € amounts inside them unchanged).
- Preserve JSON types: strings stay strings, numbers stay numbers, null stays null where applicable.
- The output must include every key from the input object; same structure.`;
}
