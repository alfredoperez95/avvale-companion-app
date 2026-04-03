import type { AreaCompania } from '@/types/yubiq';

/** Valores permitidos para `prefill.segment` en Yubiq (mayúsculas). */
export const ALLOWED_YUBIQ_SEGMENTS: readonly AreaCompania[] = ['YUBIQ', 'RUN', 'GROW', 'SAIBORG', 'WISE'] as const;

const ALLOWED_SET = new Set<string>(ALLOWED_YUBIQ_SEGMENTS);

export type NormalizeSegmentResult = {
  segment: string;
  warning?: string;
};

/**
 * Normaliza el área Avvale al segmento Yubiq.
 * Si no coincide con la lista permitida, devuelve "" y opcionalmente advertencia.
 */
export function normalizeSegment(area: AreaCompania | string | null | undefined): NormalizeSegmentResult {
  if (area == null || String(area).trim() === '') {
    return { segment: '', warning: 'segment_empty' };
  }
  const upper = String(area).trim().toUpperCase().replace(/\s+/g, '');
  if (!ALLOWED_SET.has(upper)) {
    return { segment: '', warning: 'segment_unmapped' };
  }
  return { segment: upper };
}
