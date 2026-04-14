/** Reglas de negocio: docs/YUBIQ_OFERTA_REGLAS.md */
import type { AreaCompania, ClaudeOfferExtraction, ClaudeOfferExtractionInternal, DealType } from './offer-extraction.types';
import { buildNotaMultiplesOpcionesPrecio } from './nota-multiples-opciones-precio.constant';
import {
  IMPORTE_MINIMO_BOLSA_HORAS_TM_EUROS,
  NOTA_INTERPRETACION_IMPORTE_TM_SIN_JORNADAS,
} from './nota-interpretacion-importe.constant';

const AREA_VALUES: AreaCompania[] = ['RUN', 'GROW', 'SAIBORG', 'WISE', 'YUBIQ'];

/** Convierte número o texto tipo "2.990" / "390,50" a euros (float). */
export function parseEuroAmountToNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? raw : null;
  }
  let t = String(raw).trim().replace(/€|EUR/gi, '');
  t = t.replace(/[^\d.,-]/g, '').replace(/\s+/g, '');
  if (!t || t === '-') return null;
  const hasComma = t.includes(',');
  const hasDot = t.includes('.');
  let normalized = t;
  if (hasComma && hasDot) {
    const lastComma = t.lastIndexOf(',');
    const lastDot = t.lastIndexOf('.');
    if (lastComma > lastDot) {
      normalized = t.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = t.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    const parts = t.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = `${parts[0].replace(/\./g, '')}.${parts[1]}`;
    } else {
      normalized = t.replace(/,/g, '');
    }
  } else if (hasDot && !hasComma) {
    const parts = t.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = `${parts[0].replace(/,/g, '')}.${parts[1]}`;
    } else {
      normalized = t.replace(/\./g, '');
    }
  }
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseOpcionesPrecioEstimado(raw: unknown): number | null {
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(Math.round(n), 99);
}

function parseMesesCompromiso(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
  }
  const n = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatEuroEsEnteros(n: number): string {
  const rounded = Math.round(n);
  return `${rounded.toLocaleString('es-ES')} €`;
}

function computeImporteTotalCompromiso(params: {
  proyecto: number | null;
  mensual: number | null;
  meses: number | null;
  textoCompromiso: string | null;
}): { total: number; nota: string; texto: string } | null {
  const { proyecto, mensual, meses, textoCompromiso } = params;
  if (meses == null || meses <= 0) return null;
  const p = proyecto ?? 0;
  const m = mensual ?? 0;
  if (m <= 0 && p <= 0) return null;
  if (m > 0 && p <= 0) {
    const total = m * meses;
    const ref = textoCompromiso?.trim() ? ` (${textoCompromiso.trim()})` : '';
    return {
      total,
      texto: formatEuroEsEnteros(total),
      nota: `Total estimado sobre el periodo de compromiso${ref}: ${meses} meses × ${formatEuroEsEnteros(m)}.`,
    };
  }
  if (p > 0 && m <= 0) return null;
  const total = p + m * meses;
  const ref = textoCompromiso?.trim() ? ` (${textoCompromiso.trim()})` : '';
  return {
    total,
    texto: formatEuroEsEnteros(total),
    nota: `Total estimado sobre el periodo de compromiso${ref}: ${formatEuroEsEnteros(p)} (proyecto) + ${meses} meses × ${formatEuroEsEnteros(m)}.`,
  };
}

/**
 * Proyecto one-shot + licencia/suscripción anual (una vez cada línea), cuando no hay total de compromiso mensual.
 * No suma AMS ni otros accesorios (deben ir solo en observaciones).
 */
function computeImporteTotalDealComputables(params: {
  compromiso: { total: number; texto: string; nota: string } | null;
  proyectoN: number | null;
  anualN: number | null;
}): { total: number; texto: string; nota: string } | null {
  const { compromiso, proyectoN, anualN } = params;
  if (compromiso) return null;
  const p = proyectoN ?? 0;
  const a = anualN ?? 0;
  if (p <= 0 || a <= 0) return null;
  const total = Math.round(p + a);
  return {
    total,
    texto: formatEuroEsEnteros(total),
    nota: `Total computable para Approve & Seal (proyecto + licencia/suscripción anual): ${formatEuroEsEnteros(p)} + ${formatEuroEsEnteros(a)} = ${formatEuroEsEnteros(total)}.`,
  };
}

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

  const soloTmSinJornadas = parsed.soloImporteTarifaTmSinJornadas === true;

  const proyectoN = parseEuroAmountToNumber(parsed.importeProyectoEuros);
  const mensualN = parseEuroAmountToNumber(parsed.importeMensualEuros);
  const anualLicN = parseEuroAmountToNumber(parsed.importeSuscripcionOlicenciaAnualEuros);
  const mesesN = parseMesesCompromiso(parsed.periodoCompromisoMeses);
  const textoCompromiso = (parsed.periodoCompromisoTexto ?? '').trim() || null;

  const compromiso = computeImporteTotalCompromiso({
    proyecto: proyectoN,
    mensual: mensualN,
    meses: mesesN,
    textoCompromiso,
  });

  const dealComputables = computeImporteTotalDealComputables({
    compromiso,
    proyectoN,
    anualN: anualLicN,
  });

  if (!compromiso) {
    if (
      (proyectoN != null || mensualN != null) &&
      parsed.periodoCompromisoMeses != null &&
      mesesN == null
    ) {
      warnings.push('periodoCompromisoMeses no interpretable; no se calculó total de compromiso');
    }
  }

  const numOpcionesEst = parseOpcionesPrecioEstimado(parsed.numeroOpcionesPrecioEstimado);
  const multiplesOpciones =
    parsed.multiplesOpcionesPrecio === true || (numOpcionesEst != null && numOpcionesEst >= 2);
  if (multiplesOpciones) {
    warnings.push('multiples_opciones_precio');
  }

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
      ...(soloTmSinJornadas
        ? {
            notaInterpretacionImporte: NOTA_INTERPRETACION_IMPORTE_TM_SIN_JORNADAS,
            importeRevenueTmSinJornadasNumerico: IMPORTE_MINIMO_BOLSA_HORAS_TM_EUROS,
          }
        : {}),
      ...(multiplesOpciones
        ? {
            notaMultiplesOpcionesPrecio: buildNotaMultiplesOpcionesPrecio(numOpcionesEst),
            ...(numOpcionesEst != null && numOpcionesEst >= 2
              ? { numeroOpcionesPrecioEstimado: numOpcionesEst }
              : {}),
          }
        : {}),
      ...(compromiso
        ? {
            importeTotalConCompromisoNumerico: Math.round(compromiso.total),
            importeTotalConCompromisoTexto: compromiso.texto,
            notaImporteCompromiso: compromiso.nota,
          }
        : {}),
      ...(dealComputables
        ? {
            importeTotalDealComputablesNumerico: dealComputables.total,
            importeTotalDealComputablesTexto: dealComputables.texto,
            notaImporteTotalDealComputables: dealComputables.nota,
          }
        : {}),
      dealType: normalizeDealType((parsed as any).dealType),
      areaAvvale: (parsed as any).areaAvvale ?? null,
    },
    warnings,
  };
}

