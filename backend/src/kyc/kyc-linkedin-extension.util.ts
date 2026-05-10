/**
 * Normalización y mapeos para la extensión LinkedIn → KycOrgMember.
 */

/** URL canónica para dedupe y persistencia (sin query/fragment; host linkedin en minúsculas). */
export function normalizeLinkedInProfileUrl(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';

  try {
    let u = s;
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    const parsed = new URL(u);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith('linkedin.com')) return s.slice(0, 2048);

    let path = parsed.pathname.replace(/\/+$/, '') || '';
    if (!path.startsWith('/')) path = `/${path}`;
    const out = `https://www.linkedin.com${path}`.toLowerCase();
    return out.slice(0, 2048);
  } catch {
    return s.slice(0, 2048);
  }
}

function normalizeLevelKey(levelLabel: string | null | undefined): string {
  return String(levelLabel ?? '')
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Etiquetas alineadas con ORG_LEVELS en KycOrgPanel (frontend).
 * Devuelve null para «sin asignar»; undefined si el string no es reconocido (caller decide 400).
 */
export function mapExtensionLevelLabel(levelLabel: string | null | undefined): number | null | undefined {
  const key = normalizeLevelKey(levelLabel);
  if (!key || key === 'sin asignar' || key === 'unassigned' || key === 'n/a' || key === 'na') return null;

  // 1 — C-Suite
  if (key === 'c-suite' || key === 'c suite' || key === 'csuite') return 1;
  if (key.includes('c-suite')) return 1;
  if (/^(ceo|cfo|cto|coo|cmo|chro)\b/i.test(key)) return 1;

  // 2 — VP / Dirección (antes que «director» genérico)
  if (key.includes('vicepresident') || key.includes('vice president')) return 2;
  if (key === 'vp' || /^vp\b/.test(key) || key.includes('vp/direccion') || key.includes('vp / direccion')) return 2;
  if (key.includes('director general')) return 2;

  // 3 — Director / Head
  if (key.includes('director') || key.includes('head of') || /\bhead\b/.test(key) || key.includes('jefe de area'))
    return 3;

  // 4 — Manager
  if (key.includes('manager') || key.includes('team lead') || key.includes('responsable de equipo')) return 4;

  // 5 — IC / Analyst
  if (
    /\bic\b/.test(key) ||
    key.includes('analyst') ||
    key.includes('analista') ||
    key.includes('individual contributor')
  )
    return 5;

  return undefined;
}

const NOTES_MAX = 2000;

export function buildLinkedInCaptureNotes(parts: {
  headline?: string | null;
  location?: string | null;
  rawText?: string | null;
  capturedAt?: string | null;
  profileUrl?: string | null;
}): string | null {
  const lines: string[] = [];
  if (parts.profileUrl?.trim()) lines.push(`URL: ${parts.profileUrl.trim()}`);
  if (parts.headline?.trim()) lines.push(`Headline: ${parts.headline.trim()}`);
  if (parts.location?.trim()) lines.push(`Ubicación: ${parts.location.trim()}`);
  if (parts.capturedAt?.trim()) lines.push(`Capturado: ${parts.capturedAt.trim()}`);
  if (parts.rawText?.trim()) {
    const t = parts.rawText.trim().slice(0, 1600);
    lines.push(`Detalle:\n${t}`);
  }
  const out = lines.join('\n').trim();
  if (!out) return null;
  return out.length > NOTES_MAX ? `${out.slice(0, NOTES_MAX - 1)}…` : out;
}

/** Split simple: primera palabra = nombre, resto = apellidos (KycContact). */
export function splitDisplayNameForContact(fullName: string): { firstName: string; lastName: string | null } {
  const t = fullName.trim().replace(/\s+/g, ' ');
  if (!t) return { firstName: '—', lastName: null };
  const parts = t.split(' ');
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}
