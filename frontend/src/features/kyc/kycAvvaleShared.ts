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

export function normalizeAvvalePayload(raw: unknown): KycAvvaleNormalized {
  const empty: KycAvvaleNormalized = {
    footprint: '',
    projects: [],
    solution_presence: [],
    solution_notes: {},
  };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty;
  const o = raw as Record<string, unknown>;
  const footprint = typeof o.footprint === 'string' ? o.footprint : '';
  const projectsIn = Array.isArray(o.projects) ? o.projects : [];
  const projects: KycAvvaleProject[] = [];
  for (const it of projectsIn) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) continue;
    const row = it as Record<string, unknown>;
    const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : crypto.randomUUID();
    const name = typeof row.name === 'string' ? row.name : '';
    const st = normProjectStatus(row.status);
    const notes = typeof row.notes === 'string' ? row.notes : '';
    projects.push({ id, name, status: st, notes: notes || undefined });
  }
  const presIn = Array.isArray(o.solution_presence) ? o.solution_presence : [];
  const solution_presence: KycSolutionSlug[] = [];
  for (const x of presIn) {
    const s = String(x).trim().toLowerCase();
    if (isSolutionSlug(s) && !solution_presence.includes(s)) solution_presence.push(s);
  }
  const notesIn = o.solution_notes;
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

export function stableStringify(body: ReturnType<typeof toApiBody>) {
  return JSON.stringify(body);
}
