export type KycSolutionSlug = 'grow' | 'run' | 'wise' | 'yubiq' | 'saiborg' | 'axazure';

export type KycAvvaleProjectStatus = 'active' | 'past' | 'negotiating' | 'analyzing';

export type KycAvvaleProject = {
  id: string;
  name: string;
  status: KycAvvaleProjectStatus;
  notes?: string;
};

export type KycAvvaleNormalized = {
  footprint: string;
  projects: KycAvvaleProject[];
  solution_presence: KycSolutionSlug[];
  solution_notes: Partial<Record<KycSolutionSlug, string>>;
};

export function normProjectStatus(raw: unknown): KycAvvaleProjectStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (s === 'past') return 'past';
  if (s === 'negotiating' || s === 'negotiation' || s === 'negociacion' || s === 'en_negociacion') return 'negotiating';
  if (s === 'analyzing' || s === 'en_analisis' || s === 'in_analysis' || s === 'under_analysis') {
    return 'analyzing';
  }
  return 'active';
}

export const KYC_SOLUTION_SLUGS: KycSolutionSlug[] = ['grow', 'run', 'wise', 'yubiq', 'saiborg', 'axazure'];

export const KYC_SOLUTION_LINES: { slug: KycSolutionSlug; label: string; description: string }[] = [
  { slug: 'grow', label: 'GROW', description: 'Línea GROW — crecimiento y transformación comercial.' },
  { slug: 'run', label: 'RUN', description: 'Línea RUN — operación, eficiencia y servicios gestionados.' },
  { slug: 'wise', label: 'WISE', description: 'Línea WISE — datos, analítica e inteligencia.' },
  { slug: 'yubiq', label: 'YUBIQ', description: 'Línea YUBIQ — identidad, pagos y experiencia digital.' },
  { slug: 'saiborg', label: 'SAIBORG', description: 'Línea SAIBORG — automatización e IA operativa.' },
  {
    slug: 'axazure',
    label: 'AXAZURE',
    description: 'Dynamics 365 y ecosistema Microsoft: ERP (F&O, Business Central), CRM, marketing, etc.',
  },
];

const SLUG_SET = new Set<string>(KYC_SOLUTION_SLUGS);

function isSolutionSlug(s: string): s is KycSolutionSlug {
  return SLUG_SET.has(s);
}

function unwrapJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return null;
}

function tryJsonArray(maybe: unknown): unknown[] | null {
  if (Array.isArray(maybe)) return maybe;
  if (typeof maybe === 'string' && maybe.trim()) {
    try {
      const p = JSON.parse(maybe) as unknown;
      if (Array.isArray(p)) return p;
    } catch {
      /* empty */
    }
  }
  return null;
}

function pickProjectsFromRecord(rec: Record<string, unknown>): unknown[] | null {
  const keys = ['projects', 'proyectos', 'project_list', 'Projects'] as const;
  for (const k of keys) {
    if (!(k in rec)) continue;
    const maybe = rec[k];
    const ar = tryJsonArray(maybe);
    if (ar) return ar;
    if (maybe && typeof maybe === 'object' && !Array.isArray(maybe)) {
      const vals = Object.values(maybe as Record<string, unknown>);
      if (
        vals.length > 0 &&
        vals.every((x) => x != null && typeof x === 'object' && !Array.isArray(x))
      ) {
        return vals;
      }
    }
  }
  return null;
}

function extractProjectsArrayFromAvvaleRoot(o: Record<string, unknown>): unknown[] {
  const roots: Record<string, unknown>[] = [];
  const seen = new Set<Record<string, unknown>>();
  for (const r of [o, o.value, o.data]) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const rec = r as Record<string, unknown>;
    if (seen.has(rec)) continue;
    seen.add(rec);
    roots.push(rec);
  }
  for (const rec of roots) {
    const found = pickProjectsFromRecord(rec);
    if (found) return found;
  }
  return [];
}

function rowProjectName(row: Record<string, unknown>): string {
  const v = row.name ?? row.nombre ?? row.title ?? row.project_name ?? row.proyecto;
  if (typeof v === 'string') return v;
  if (v != null) return String(v);
  return '';
}
function rowProjectStatusRaw(row: Record<string, unknown>): unknown {
  return row.status ?? row.estado;
}
function rowProjectNotes(row: Record<string, unknown>): string {
  const v = row.notes ?? row.notas;
  if (typeof v === 'string') return v;
  if (v != null) return String(v);
  return '';
}

export function normalizeAvvalePayload(raw: unknown): KycAvvaleNormalized {
  const empty: KycAvvaleNormalized = {
    footprint: '',
    projects: [],
    solution_presence: [],
    solution_notes: {},
  };
  const o = unwrapJsonObject(raw);
  if (!o) return empty;
  const footprint = typeof o.footprint === 'string' ? o.footprint : '';
  const projectsIn = extractProjectsArrayFromAvvaleRoot(o);
  const projects: KycAvvaleProject[] = [];
  for (const it of projectsIn) {
    if (typeof it === 'string') {
      const n = it.trim();
      if (n) projects.push({ id: crypto.randomUUID(), name: n, status: 'active' });
      continue;
    }
    if (!it || typeof it !== 'object' || Array.isArray(it)) continue;
    const row = it as Record<string, unknown>;
    const idRaw = row.id != null ? String(row.id).trim() : '';
    const id = idRaw || crypto.randomUUID();
    const name = rowProjectName(row);
    const st = normProjectStatus(rowProjectStatusRaw(row));
    const notes = rowProjectNotes(row);
    projects.push({ id, name, status: st, notes: notes || undefined });
  }
  const presIn = Array.isArray(o.solution_presence)
    ? o.solution_presence
    : Array.isArray(o.solutionPresence)
      ? o.solutionPresence
      : [];
  const solution_presence: KycSolutionSlug[] = [];
  for (const x of presIn) {
    const s = String(x).trim().toLowerCase();
    if (isSolutionSlug(s) && !solution_presence.includes(s)) solution_presence.push(s);
  }
  const notesIn = o.solution_notes ?? o.solutionNotes;
  const solution_notes: Partial<Record<KycSolutionSlug, string>> = {};
  if (notesIn && typeof notesIn === 'object' && !Array.isArray(notesIn)) {
    for (const [k, v] of Object.entries(notesIn as Record<string, unknown>)) {
      const slug = k.trim().toLowerCase();
      if (!isSolutionSlug(slug)) continue;
      if (typeof v === 'string' && v.trim()) solution_notes[slug] = v.trim();
    }
  }
  return { footprint, projects, solution_presence, solution_notes };
}

export function toApiBody(state: KycAvvaleNormalized) {
  const solution_notes: Record<string, string> = {};
  for (const slug of state.solution_presence) {
    const n = state.solution_notes[slug];
    if (n && n.trim()) solution_notes[slug] = n.trim();
  }
  return {
    footprint: state.footprint.trim(),
    projects: state.projects.map((p) => ({
      id: p.id,
      name: p.name.trim(),
      status: p.status,
      ...(p.notes != null && String(p.notes).trim() ? { notes: String(p.notes).trim() } : {}),
    })),
    solution_presence: [...state.solution_presence],
    ...(Object.keys(solution_notes).length ? { solution_notes } : {}),
  };
}

/** PATCH parcial: footprint y presencia sin `projects` (el servidor fusiona y conserva la lista existente). */
export function toAvvalePresencePatchBody(
  state: Pick<KycAvvaleNormalized, 'footprint' | 'solution_presence' | 'solution_notes'>,
) {
  const solution_notes: Record<string, string> = {};
  for (const slug of state.solution_presence) {
    const n = state.solution_notes[slug];
    solution_notes[slug] = n && String(n).trim() ? String(n).trim() : '';
  }
  return {
    footprint: state.footprint.trim(),
    solution_presence: [...state.solution_presence],
    solution_notes,
  };
}

export function stableStringify(body: ReturnType<typeof toApiBody>) {
  return JSON.stringify(body);
}
