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

/**
 * Metadatos de línea para la pestaña KYC «Avvale».
 * `guidance` replica los criterios de `avvaleAreas` en la síntesis RFQ (`rfq-synthesis-prompt.ts`): misma taxonomía;
 * aquí solo marcas presencia en el perfil (sin inferencia automática).
 */
export type KycSolutionLineMeta = {
  slug: KycSolutionSlug;
  label: string;
  /** Texto corto (placeholder de notas, ayudas compactas). */
  description: string;
  /** Criterio completo alineado con el prompt de síntesis RFQ (p. ej. tooltip en chips). */
  guidance: string;
};

export const KYC_SOLUTION_LINES: KycSolutionLineMeta[] = [
  {
    slug: 'grow',
    label: 'GROW',
    description: 'Cambio funcional / implantación (ERP, CRM, blueprint, rollout).',
    guidance:
      'GROW: proyectos de cambio funcional o de implantación: roll-out / greenfield / brownfield de módulos o soluciones (ERP, CRM, sectorial), rediseño de procesos, blueprint, fit-gap, localización legal, gestión del cambio y formación funcional, assessments de madurez de negocio, T&M o fixed price orientados a resultado funcional, desarrollo ABAP / extensions clásicas ligadas a requisitos de negocio, preparación de cutover funcional, migración maestros/transaccionales desde perspectiva funcional. Si el núcleo es «transformar o desplegar cómo trabaja el negocio», suele ser GROW.',
  },
  {
    slug: 'run',
    label: 'RUN',
    description: 'Operación recurrente del landscape; AMS, Basis, DR, monitorización.',
    guidance:
      'RUN: operación recurrente del landscape (on-prem, cloud privado, hyperscaler o híbrido): Basis / administración técnica SAP y no SAP, instalación y parcheo, upgrades técnicos (EHP, stacks), migraciones de sistema «lift» o rehosting sin rediseño funcional mayor, alta disponibilidad, backup y recuperación, DR, monitorización APM y observabilidad, gestión de incidentes y capacidad, redes y conectividad corporativa, ciberoperación de infra (firewalls, WAF operados), AMS técnico o AMS funcional centrado en estabilidad y evolutivos acotados, soporte 24x7, finops operativo ligado a explotación. Si el núcleo es «mantener en marcha y optimizar coste/riesgo», suele ser RUN.',
  },
  {
    slug: 'wise',
    label: 'WISE',
    description: 'CFO / office of finance: EPM, consolidación, planning, ESG financiero.',
    guidance:
      'WISE: oferta orientada a CFO / office of finance: EPM y corporate performance (Group Reporting, consolidación, reporting regulatorio), planning, budgeting & forecasting, simulaciones, tax provisioning y reporting fiscal de grupo, treasury analytics, profitability y cost management, sostenibilidad y reporting ESG financiero-regulatorio (CSRD, métricas financieras de sostenibilidad) cuando el foco es reporting de dirección y no solo BI operativo. Si el núcleo es «cerrar, planificar y gobernar las cifras de empresa / grupo», suele ser WISE.',
  },
  {
    slug: 'yubiq',
    label: 'YUBIQ',
    description: 'Identidad, pagos, canales digitales regulados, compliance O2C/P2P.',
    guidance:
      'YUBIQ: identidad digital, acceso y privilegios (CIAM, IAM, SSO), experiencia de cliente o ciudadano (portales, onboarding digital), medios de pago, pasarelas y orquestación de pagos, factura electrónica y compliance normativo del ciclo order-to-cash / procure-to-pay digital, antifraude y confianza, productos y propuestas explícitas de la línea YUBIQ o B+ y compliance digital asociado. Si el núcleo es «confianza, identidad, pago o canal digital regulado», suele ser YUBIQ.',
  },
  {
    slug: 'saiborg',
    label: 'SAIBORG',
    description: 'Integración, datos como producto, BTP, automatización e IA aplicada.',
    guidance:
      'SAIBORG: plataformas de integración e interoperabilidad (SAP Integration Suite / CPI / API Management, MuleSoft, Boomi, Kafka, event mesh, EDI/B2B), API-first, federación y gobierno del dato, data products, lakehouse / ingesta / calidad cuando van ligados a integración o productización de datos, analytics operativas (Power BI, Tableau, Datasphere) como capa de producto o self-service corporativo, SAC analítico no dominado por CFO group close, BTP (Extension Suite, CAP, side-by-side), Fiori / UX enterprise, automatización e hiperautomatización (RPA, orchestration), IA aplicada (copilots, asistentes, ML en procesos), OpenPlatform u ofertas de producto software propias en ese espectro. Si el núcleo es «conectar, exponer datos/servicios o automatizar con plataforma», suele ser SAIBORG.',
  },
  {
    slug: 'axazure',
    label: 'AXAZURE',
    description: 'Dynamics 365, BC/F&O, Power Platform cuando son el stack protagonista.',
    guidance:
      'AXAZURE: línea Microsoft / Dynamics y ecosistema Azure orientado a aplicaciones de negocio: Dynamics 365 (Sales, Customer Service, Field Service, Marketing, Customer Insights), ERP Microsoft (Finance & Operations / F&O, Supply Chain Management, Business Central), Power Platform (Power Apps, Power Automate, Power Pages, Dataverse, Copilot Studio cuando va ligado a apps D365), integraciones habituales del stack Microsoft (Dataverse, Dual-write, Azure Logic Apps en contexto D365), implementación, roll-out, upgrade funcional-técnico, AMS o migración en la que D365 / BC / F&O sea el sistema protagonista. No uses AXAZURE solo por citarse Microsoft 365 genérico (correo, Teams sin proyecto D365/Power Platform) ni por BI aislado si el RFQ no ancla claramente el stack Dynamics / Power Platform. Si el núcleo es «Microsoft Business Applications o Dynamics como plataforma protagonista», suele ser AXAZURE.',
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
