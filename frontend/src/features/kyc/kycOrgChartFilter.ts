/**
 * Oculta del organigrama visual a partners tecnológicos y actores de competencia,
 * que suelen cargarse como org_member pero no forman parte de la estructura interna.
 */

const EXCLUDED_AREAS_NORMALIZED = new Set([
  'partner tecnológico',
  'partner tecnologico',
  'partners tecnológicos',
  'partners tecnologicos',
  'socio tecnológico',
  'socio tecnologico',
  'proveedor tecnológico',
  'proveedor tecnologico',
  'consultora externa',
  'consultoría externa',
  'consultoria externa',
  'competencia',
  'competidor',
  'empresa competidora',
  'externo — partner',
  'externo - partner',
]);

/** Partner / consultoría tech (no empleados internos). */
const PARTNER_TECH_RE =
  /\b(partner\s+tecn[oó]log|socio\s+tecn[oó]log|proveedor\s+tecn[oó]log|vendor\s+tecn[oó]log|technology\s+partner|consultor[ií]a\s+tecnol[oó]gica|consultora\s+tecnol[oó]gica\s+extern|firma\s+externa\s+tecnol|desarrollo\s+subcontrat|subcontrat(o|a|ación)|implementador\s+extern|integrador\s+extern|partner\s+tech)\b/i;

/** Competencia de mercado (no personas internas). */
const COMPETITION_RE =
  /\b(competidores?(\s+directo)?|empresa\s+rival|rival(es)?\s+comercial(es)?|actor(es)?\s+competitivos?|empresa\s+competidora)\b/i;

export type KycOrgMemberLike = {
  name: string;
  role?: string | null;
  area?: string | null;
  notes?: string | null;
};

export function isExcludedFromKycOrgChart(m: KycOrgMemberLike): boolean {
  const areaNorm = (m.area || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (areaNorm && EXCLUDED_AREAS_NORMALIZED.has(areaNorm)) return true;

  const blob = [m.name, m.role, m.area, m.notes].filter(Boolean).join('\n');
  if (!blob.trim()) return false;

  if (PARTNER_TECH_RE.test(blob)) return true;
  if (COMPETITION_RE.test(blob)) return true;

  return false;
}

export function filterKycOrgChartMembers<M extends KycOrgMemberLike>(members: M[]): M[] {
  return members.filter((m) => !isExcludedFromKycOrgChart(m));
}
