import type { AreaCompania, ClaudeOfferExtraction, ClaudeOfferExtractionInternal, DealType } from './offer-extraction.types';

const AREA_VALUES: AreaCompania[] = ['RUN', 'GROW', 'SAIBORG', 'WISE', 'YUBIQ'];

export function normalizeAreaCompania(raw: unknown): AreaCompania | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const upper = s.toUpperCase();
  if (AREA_VALUES.includes(upper as AreaCompania)) return upper as AreaCompania;
  return null;
}

export function recoverAreaCompaniaFromObservaciones(obs: string | null | undefined): AreaCompania | null {
  const text = (obs ?? '').toUpperCase();
  for (const a of AREA_VALUES) {
    if (text.includes(a)) return a;
  }
  return null;
}

function clamp01(n: unknown): number {
  const v = typeof n === 'number' ? n : Number.parseFloat(String(n));
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function normalizeDealType(raw: unknown): DealType | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s === 'New Opportunity') return 'New Opportunity';
  const upper = s.toUpperCase();
  if (upper === 'RENOVACIÓN' || upper === 'RENOVACION') return 'Renovación';
  if (upper === 'UPSELL') return 'Upsell';
  return null;
}

export function normalizeClaudeExtraction(
  parsed: ClaudeOfferExtractionInternal,
): { normalized: ClaudeOfferExtraction; warnings: string[] } {
  const warnings: string[] = [];
  const areaFromField = normalizeAreaCompania(parsed.areaCompania);
  let area: AreaCompania | null = areaFromField;
  if (!area) {
    const recovered = recoverAreaCompaniaFromObservaciones(parsed.observaciones);
    if (recovered) {
      area = recovered;
      warnings.push('areaCompania recuperada desde observaciones');
    }
  }
  if (parsed.areaCompania && !areaFromField) {
    warnings.push('areaCompania inválida devuelta por Claude; se ha convertido a null');
  }

  const confidenceRaw = parsed.confidence ?? {};

  return {
    normalized: {
      titulo: (parsed.titulo ?? '').trim(),
      nombreCliente: (parsed.nombreCliente ?? '').trim(),
      importeOferta: (parsed.importeOferta ?? '').trim(),
      areaCompania: area,
      resumen: (parsed.resumen ?? '').trim(),
      observaciones: (parsed.observaciones ?? '').trim(),
      confidence: {
        titulo: clamp01(confidenceRaw.titulo),
        nombreCliente: clamp01(confidenceRaw.nombreCliente),
        importeOferta: clamp01(confidenceRaw.importeOferta),
        areaCompania: clamp01(confidenceRaw.areaCompania),
        resumen: clamp01(confidenceRaw.resumen),
      },
      dealType: normalizeDealType((parsed as any).dealType),
      areaAvvale: (parsed as any).areaAvvale ?? null,
    },
    warnings,
  };
}

