/** Reglas de negocio (revenue Yubiq): docs/YUBIQ_OFERTA_REGLAS.md */
import type {
  BuildYubiqPayloadInput,
  BuildYubiqPayloadResult,
  PrefillReviewFlags,
  YubiqChromePayload,
  YubiqTargetId,
} from '@/types/yubiq-payload';
import { YUBIQ_PAYLOAD_SCHEMA_VERSION, YUBIQ_TARGETS } from '@/types/yubiq-payload';
import { buildPrefillTitle } from './build-prefill-title';
import { debugYubiqPayloadBuild } from './debug-yubiq-payload';
import { parseAmountAndCurrency } from './normalize-revenue';
import { normalizeSegment } from './normalize-segment';
import { parseManualMarginToNumber } from './parse-manual-margin';
import { validateYubiqPayload } from './validate-yubiq-payload';

/** Fecha local YYYY-MM-DD para `toBeSigned` (no UTC). */
function formatLocalYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Construye el JSON estable para la extensión Chrome (prefill Yubiq #addnew).
 */
export function buildYubiqPayload(input: BuildYubiqPayloadInput): BuildYubiqPayloadResult {
  const target: YubiqTargetId = input.target ?? 'yubiq_addnew';
  const now = input.now ?? new Date();
  const { extraction, fileName } = input;

  const warnings: string[] = [];

  const seg = normalizeSegment(extraction.areaCompania);
  if (seg.warning) warnings.push(seg.warning);
  if (seg.segment === '' && extraction.areaCompania) {
    /* ya cubierto por segment_unmapped o segment_empty */
  }

  const compromisoNum = extraction.importeTotalConCompromisoNumerico;
  const useCompromisoTotal =
    typeof compromisoNum === 'number' && Number.isFinite(compromisoNum) && compromisoNum > 0;
  const tmNum = extraction.importeRevenueTmSinJornadasNumerico;
  const useTmSinJornadasRevenue =
    !useCompromisoTotal &&
    typeof tmNum === 'number' &&
    Number.isFinite(tmNum) &&
    tmNum > 0;
  const amountParsed = useCompromisoTotal
    ? {
        amount: String(Math.round(compromisoNum)),
        currency: 'EUR',
        revenue: String(Math.round(compromisoNum)),
        warnings: [] as string[],
      }
    : useTmSinJornadasRevenue
      ? {
          amount: String(Math.round(tmNum)),
          currency: 'EUR',
          revenue: String(Math.round(tmNum)),
          warnings: [] as string[],
        }
      : parseAmountAndCurrency(extraction.importeOferta ?? '');
  warnings.push(...amountParsed.warnings);
  if (useCompromisoTotal) {
    warnings.push('revenue_from_importe_total_compromiso');
  }
  if (useTmSinJornadasRevenue) {
    warnings.push('revenue_from_tm_sin_jornadas_min');
  }

  const prefillTitle = buildPrefillTitle(extraction.titulo ?? '', extraction.nombreCliente ?? '');

  const documentBlock = {
    fileName: fileName.trim(),
    title: (extraction.titulo ?? '').trim(),
    client: (extraction.nombreCliente ?? '').trim(),
    summary: (extraction.resumen ?? '').trim(),
    amount: amountParsed.amount,
    currency: amountParsed.currency,
    regulatedArea: (extraction.areaCompania ?? '').toString().trim() || '',
  };

  const prefill = {
    title: prefillTitle,
    description: (extraction.resumen ?? '').trim(),
    toBeSigned: formatLocalYyyyMmDd(now),
    documentType: 'offer' as const,
    customerName: (extraction.nombreCliente ?? '').trim(),
    company: 'espana' as const,
    segment: seg.segment,
    revenue: amountParsed.revenue,
  };

  const marginNum = parseManualMarginToNumber(input.manualMargin);
  const basePayload: YubiqChromePayload = {
    schemaVersion: YUBIQ_PAYLOAD_SCHEMA_VERSION,
    target,
    targetUrl: YUBIQ_TARGETS[target].targetUrl,
    generatedAt: now.toISOString(),
    document: documentBlock,
    prefill,
    ...(marginNum !== undefined ? { manualMargin: marginNum } : {}),
  };

  const { isValid, errors: validationErrors } = validateYubiqPayload(basePayload);

  const prefillReview: PrefillReviewFlags = {
    segment: seg.warning === 'segment_unmapped',
    revenue: amountParsed.warnings.includes('revenue_unparsed'),
  };

  const includeCompanionMeta = input.includeCompanionMeta !== false;
  const payload: YubiqChromePayload = includeCompanionMeta
    ? {
        ...basePayload,
        companionMeta: {
          schemaVersion: YUBIQ_PAYLOAD_SCHEMA_VERSION,
          generatedAt: now.toISOString(),
          isValid,
          validationErrors,
          warnings,
          prefillReview,
          document: documentBlock,
        },
      }
    : basePayload;

  debugYubiqPayloadBuild({
    stage: 'buildYubiqPayload',
    warnings,
    isValid,
    validationErrors,
    target,
  });

  if (input.verboseDebug && process.env.NODE_ENV === 'development') {
    console.debug('[yubiq-payload:full]', payload);
  }

  return {
    payload,
    warnings,
    isValid,
    validationErrors,
    prefillReview,
  };
}
