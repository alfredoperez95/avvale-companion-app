import { KycProfile, Prisma } from '@prisma/client';

/** Formato alineado con el HTML estático en `public/kyc` (nombres snake_case, ids numéricos). */
export function toApiCompanyListRow(
  c: {
    id: bigint;
    name: string;
    sector: string | null;
    industry: string | null;
    website: string | null;
    city: string | null;
    revenue: string | null;
    employees: string | null;
    profile: KycProfile | null;
    _count: { signals: number; orgMembers: number };
  },
) {
  const p = c.profile;
  return {
    id: Number(c.id),
    name: c.name,
    sector: c.sector,
    industry: c.industry,
    website: c.website,
    city: c.city,
    revenue: c.revenue,
    employees: c.employees,
    kyc_active: p != null,
    strategic: p?.strategic ?? null,
    last_enriched_at: p?.lastEnrichedAt ? p.lastEnrichedAt.toISOString() : null,
    summary: p?.summary ?? null,
    signal_count: c._count.signals,
    org_count: c._count.orgMembers,
    completeness: p ? completenessFromProfile(p) : 0,
  };
}

const PROFILE_BLOCKS = [
  'economics',
  'business_model',
  'customers',
  'tech_stack',
  'critical_processes',
  'sector_context',
] as const;

export function completenessFromProfile(
  p: {
    economics: Prisma.JsonValue;
    businessModel: Prisma.JsonValue;
    customers: Prisma.JsonValue;
    techStack: Prisma.JsonValue;
    criticalProcesses: Prisma.JsonValue;
    sectorContext: Prisma.JsonValue;
    competencia: Prisma.JsonValue;
    summary: string | null;
  } | null,
) {
  if (!p) return 0;
  const row = {
    economics: p.economics,
    business_model: p.businessModel,
    customers: p.customers,
    tech_stack: p.techStack,
    critical_processes: p.criticalProcesses,
    sector_context: p.sectorContext,
    competencia: p.competencia,
    summary: p.summary,
  } as Record<string, unknown>;
  return completenessScoreObject(row);
}

function competenciaHasPartner(row: Record<string, unknown>): boolean {
  const c = row.competencia;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  const items = (c as { items?: unknown }).items;
  if (!Array.isArray(items)) return false;
  return items.some((it) => {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return false;
    const name = String((it as { partner_name?: string }).partner_name ?? '').trim();
    return name.length > 0;
  });
}

function completenessScoreObject(row: Record<string, unknown>) {
  let filled = 0;
  for (const b of PROFILE_BLOCKS) {
    const v = row[b];
    if (v && typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v as object).length > 0) {
      filled += 1;
    }
  }
  if (row.summary && typeof row.summary === 'string' && row.summary.length > 20) filled += 1;
  if (competenciaHasPartner(row)) filled += 1;
  const denom = PROFILE_BLOCKS.length + 2;
  return Math.round((filled / denom) * 100);
}

export function profileToApi(p: {
  companyId: bigint;
  economics: Prisma.JsonValue;
  businessModel: Prisma.JsonValue;
  customers: Prisma.JsonValue;
  techStack: Prisma.JsonValue;
  criticalProcesses: Prisma.JsonValue;
  sectorContext: Prisma.JsonValue;
  competencia: Prisma.JsonValue;
  summary: string | null;
  confidenceScore: number | null;
  strategic: boolean;
  lastEnrichedAt: Date | null;
}) {
  return {
    company_id: Number(p.companyId),
    economics: p.economics,
    business_model: p.businessModel,
    customers: p.customers,
    tech_stack: p.techStack,
    critical_processes: p.criticalProcesses,
    sector_context: p.sectorContext,
    competencia: p.competencia,
    summary: p.summary,
    confidence_score: p.confidenceScore,
    strategic: p.strategic,
    last_enriched_at: p.lastEnrichedAt != null ? p.lastEnrichedAt.toISOString() : null,
  };
}

export function companyToApi(c: {
  id: bigint;
  name: string;
  sector: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  revenue: string | null;
  employees: string | null;
  techStack: string | null;
  source: string | null;
  notes: string | null;
}) {
  return {
    id: Number(c.id),
    name: c.name,
    sector: c.sector,
    industry: c.industry,
    city: c.city,
    country: c.country,
    website: c.website,
    revenue: c.revenue,
    employees: c.employees,
    tech_stack: c.techStack,
    source: c.source,
    notes: c.notes,
  };
}

export function orgMemberToApi(m: {
  id: bigint;
  companyId: bigint;
  name: string;
  role: string | null;
  area: string | null;
  level: number | null;
  reportsToId: bigint | null;
  linkedin: string | null;
  notes: string | null;
  contactId: bigint | null;
  source: string | null;
  createdAt: Date;
}) {
  return {
    id: Number(m.id),
    company_id: Number(m.companyId),
    name: m.name,
    role: m.role,
    area: m.area,
    level: m.level,
    reports_to_id: m.reportsToId != null ? Number(m.reportsToId) : null,
    linkedin: m.linkedin,
    notes: m.notes,
    contact_id: m.contactId != null ? Number(m.contactId) : null,
    source: m.source,
    created_at: m.createdAt.toISOString(),
  };
}

export function orgRelToApi(r: {
  id: bigint;
  companyId: bigint;
  fromMemberId: bigint;
  toMemberId: bigint;
  type: string;
  strength: number | null;
  notes: string | null;
  createdAt: Date;
}) {
  return {
    id: Number(r.id),
    company_id: Number(r.companyId),
    from_member_id: Number(r.fromMemberId),
    to_member_id: Number(r.toMemberId),
    type: r.type,
    strength: r.strength,
    notes: r.notes,
    created_at: r.createdAt.toISOString(),
  };
}

export function signalToApi(
  s: {
    id: bigint;
    companyId: bigint;
    source: string;
    sourceUrl: string | null;
    sentiment: string | null;
    rating: Prisma.Decimal | null;
    title: string | null;
    text: string | null;
    signalType: string | null;
    publishedAt: Date | null;
    capturedAt: Date;
  },
) {
  return {
    id: Number(s.id),
    company_id: Number(s.companyId),
    source: s.source,
    source_url: s.sourceUrl,
    sentiment: s.sentiment,
    rating: s.rating != null ? Number(s.rating) : null,
    title: s.title,
    text: s.text,
    signal_type: s.signalType,
    published_at: s.publishedAt ? s.publishedAt.toISOString() : null,
    captured_at: s.capturedAt.toISOString(),
  };
}

export function openQToApi(q: {
  id: bigint;
  companyId: bigint;
  topic: string;
  question: string;
  priority: number;
  status: string;
  answer: string | null;
  source: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}) {
  return {
    id: Number(q.id),
    company_id: Number(q.companyId),
    topic: q.topic,
    question: q.question,
    priority: q.priority,
    status: q.status,
    answer: q.answer,
    source: q.source,
    created_at: q.createdAt.toISOString(),
    resolved_at: q.resolvedAt ? q.resolvedAt.toISOString() : null,
  };
}

export function chatSessionToApi(s: {
  id: bigint;
  companyId: bigint;
  userId: string | null;
  title: string | null;
  workdir: string | null;
  sessionType: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: Number(s.id),
    company_id: Number(s.companyId),
    user_id: s.userId,
    title: s.title,
    workdir: s.workdir,
    session_type: s.sessionType,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
}

export function chatMessageToApi(m: {
  id: bigint;
  sessionId: bigint;
  role: string;
  content: string;
  meta: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: Number(m.id),
    session_id: Number(m.sessionId),
    role: m.role,
    content: m.content,
    meta: m.meta,
    created_at: m.createdAt.toISOString(),
  };
}
