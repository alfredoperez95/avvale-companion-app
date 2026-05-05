import { KycOrgRelationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';

const PROFILE_BLOCKS = new Set(['economics', 'business_model', 'customers', 'tech_stack', 'critical_processes', 'sector_context']);

/** Topics estables para open_question (alineado con frontend kycConstants + org/signals). */
const CANONICAL_OPEN_TOPICS = new Set([
  'economics',
  'business_model',
  'customers',
  'tech_stack',
  'critical_processes',
  'sector_context',
  'competencia',
  'org',
  'signals',
  'general',
]);

const log = new Logger('KycApplyProposed');

export function normalizeOpenQuestionDedupeKey(question: string): string {
  return String(question || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[¿?¡!.,;:]/g, '')
    .slice(0, 500);
}

export function canonicalOpenQuestionTopic(raw: string): string {
  const t = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  if (CANONICAL_OPEN_TOPICS.has(t)) return t;
  const aliases: Record<string, string> = {
    economia: 'economics',
    modelo: 'business_model',
    modelo_negocio: 'business_model',
    negocio: 'business_model',
    cliente: 'customers',
    clientes: 'customers',
    stack: 'tech_stack',
    tecnologia: 'tech_stack',
    tecnología: 'tech_stack',
    procesos: 'critical_processes',
    sector: 'sector_context',
    competencia: 'competencia',
    partners: 'competencia',
    competidores: 'competencia',
    organigrama: 'org',
    organizacion: 'org',
    organización: 'org',
    senales: 'signals',
    señales: 'signals',
  };
  return aliases[t] ?? 'general';
}

/** Soporta `field_path` tipo `tech_stack.erp` sin partir `tech_stack` en un solo `split`. */
function blockAndRestFromPath(fp: string): { block: string; rest: string[] } {
  const ordered = [
    'critical_processes',
    'business_model',
    'sector_context',
    'tech_stack',
    'economics',
    'customers',
  ];
  for (const b of ordered) {
    if (fp === b) return { block: b, rest: [] };
    if (fp.startsWith(b + '.')) return { block: b, rest: fp.slice(b.length + 1).split('.').filter(Boolean) };
  }
  return { block: fp.split('.')[0] ?? '', rest: fp.split('.').slice(1) };
}

export type ProposedItem = {
  field_path?: string;
  value?: unknown;
  source?: string;
};

export function extractProposedItems(assistantText: string): ProposedItem[] {
  if (!assistantText) return [];
  const line = assistantText.split('\n').find((l) => l.trim().startsWith('KYC_PROPOSED_JSON:'));
  if (line) {
    const raw = line.split('KYC_PROPOSED_JSON:')[1]?.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? (parsed as ProposedItem[]) : [parsed as ProposedItem];
      } catch {
        /* empty */
      }
    }
  }
  const m = assistantText.match(/\[[\s\S]*"field_path"[\s\S]*\]/);
  if (m) {
    try {
      const a = JSON.parse(m[0]) as unknown;
      if (Array.isArray(a)) return a as ProposedItem[];
    } catch {
      /* empty */
    }
  }
  return [];
}

export async function applyProposedItems(
  prisma: PrismaService,
  companyId: bigint,
  userId: string | null,
  items: ProposedItem[],
  chatMessageId?: bigint,
): Promise<number> {
  if (!items.length) return 0;
  let applied = 0;
  await ensureProfile(prisma, companyId);
  const openRows = await prisma.kycOpenQuestion.findMany({
    where: { companyId, status: 'open' },
    select: { question: true },
  });
  const dedupeKeys = new Set(openRows.map((r) => normalizeOpenQuestionDedupeKey(r.question)));
  for (const up of items) {
    try {
      const fp = up.field_path;
      const val = up.value;
      if (!fp) continue;
      if (fp === 'open_question') {
        if (!val || typeof val !== 'object' || !('question' in (val as object))) continue;
        const o = val as { topic?: string; question: string; priority?: number };
        if (!o.question) continue;
        const key = normalizeOpenQuestionDedupeKey(o.question);
        if (!key || dedupeKeys.has(key)) continue;
        dedupeKeys.add(key);
        const topic = canonicalOpenQuestionTopic(o.topic ?? 'general');
        await prisma.kycOpenQuestion.create({
          data: {
            companyId,
            topic,
            question: o.question.trim(),
            priority: o.priority ?? 2,
            source: up.source ?? 'intake',
            status: 'open',
          },
        });
        applied += 1;
        continue;
      }
      if (fp === 'org_member') {
        if (!val || typeof val !== 'object' || !('name' in (val as object))) continue;
        const o = val as { name: string; role?: string; area?: string; linkedin?: string; notes?: string };
        if (!o.name) continue;
        await prisma.kycOrgMember.create({
          data: {
            companyId,
            name: o.name,
            role: o.role ?? null,
            area: o.area ?? null,
            linkedin: o.linkedin ?? null,
            notes: o.notes ?? null,
            source: up.source ?? 'intake',
          },
        });
        applied += 1;
        continue;
      }
      if (fp === 'summary') {
        await prisma.kycProfile.update({
          where: { companyId },
          data: { summary: String(val ?? '') },
        });
        await recordFact(prisma, companyId, 'summary', val, null, up.source ?? 'intake', userId, chatMessageId);
        applied += 1;
        continue;
      }
      if (fp === 'competencia_partner') {
        if (!val || typeof val !== 'object' || Array.isArray(val) || !('partner_name' in val)) continue;
        const o = val as {
          partner_name: string;
          ambitos?: unknown;
          detalle?: unknown;
          analisis?: unknown;
          momentum?: unknown;
        };
        const name = String(o.partner_name ?? '').trim();
        if (!name) continue;
        const prevProf = await prisma.kycProfile.findUniqueOrThrow({ where: { companyId } });
        const rawPrev = prevProf.competencia;
        const docPrev =
          rawPrev && typeof rawPrev === 'object' && !Array.isArray(rawPrev)
            ? (rawPrev as { items?: unknown })
            : {};
        const itemsPrev = Array.isArray(docPrev.items) ? docPrev.items : [];
        const row = {
          partner_name: name,
          ambitos: normalizeCompetenciaAmbitos(o.ambitos),
          detalle: o.detalle != null ? String(o.detalle) : '',
          analisis: o.analisis != null ? String(o.analisis) : '',
          momentum: normalizeCompetenciaMomentum(o.momentum),
        };
        const nextItems = [...itemsPrev, row];
        await prisma.kycProfile.update({
          where: { companyId },
          data: { competencia: { items: nextItems } },
        });
        await recordFact(prisma, companyId, fp, row, itemsPrev, up.source ?? 'intake', userId, chatMessageId);
        applied += 1;
        continue;
      }
      const { block, rest } = blockAndRestFromPath(fp);
      if (block && PROFILE_BLOCKS.has(block)) {
        if (rest.length === 0) {
          const col = fieldForBlock(block);
          const prev = await prisma.kycProfile.findUniqueOrThrow({ where: { companyId } });
          const key = col as 'economics' | 'businessModel' | 'customers' | 'techStack' | 'criticalProcesses' | 'sectorContext';
          const before = prev[key] as object | null;
          const merged = { ...(before && typeof before === 'object' && !Array.isArray(before) ? before : {}), ...(typeof val === 'object' && val && !Array.isArray(val) ? (val as object) : { value: val }) };
          await prisma.kycProfile.update({
            where: { companyId },
            data: { [key]: merged },
          });
        } else {
          const col = fieldForBlock(block);
          const key = col as 'economics' | 'businessModel' | 'customers' | 'techStack' | 'criticalProcesses' | 'sectorContext';
          const prev = await prisma.kycProfile.findUniqueOrThrow({ where: { companyId } });
          const before = prev[key] as object;
          const current = { ...(before && typeof before === 'object' && !Array.isArray(before) ? before : {}) } as Record<string, unknown>;
          let node: Record<string, unknown> = current;
          for (let i = 0; i < rest.length - 1; i++) {
            const k0 = rest[i]!;
            const n = node[k0];
            if (!n || typeof n !== 'object' || Array.isArray(n)) node[k0] = {};
            node = node[k0] as Record<string, unknown>;
          }
          node[rest[rest.length - 1]!] = val as unknown;
          await prisma.kycProfile.update({
            where: { companyId },
            data: { [key]: current },
          });
        }
        await recordFact(prisma, companyId, fp, val, null, up.source ?? 'intake', userId, chatMessageId);
        applied += 1;
      }
    } catch (e) {
      log.warn((e as Error).message, up);
    }
  }
  return applied;
}

function fieldForBlock(
  b: string,
):
  | 'economics'
  | 'businessModel'
  | 'customers'
  | 'techStack'
  | 'criticalProcesses'
  | 'sectorContext' {
  if (b === 'economics') return 'economics';
  if (b === 'business_model') return 'businessModel';
  if (b === 'customers') return 'customers';
  if (b === 'tech_stack') return 'techStack';
  if (b === 'critical_processes') return 'criticalProcesses';
  if (b === 'sector_context') return 'sectorContext';
  return 'economics';
}

async function ensureProfile(prisma: PrismaService, companyId: bigint) {
  await prisma.kycProfile.upsert({
    where: { companyId },
    create: {
      companyId,
      economics: {},
      businessModel: {},
      customers: {},
      techStack: {},
      criticalProcesses: {},
      sectorContext: {},
      competencia: {},
    },
    update: {},
  });
}

const COMPETENCIA_AMBITOS = new Set(['tecnico', 'funcional', 'estrategia']);

function normalizeCompetenciaAmbitos(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    const s = String(x)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    const slug = s.replace(/[^a-z0-9_]/g, '');
    const map: Record<string, string> = {
      tecnico: 'tecnico',
      técnico: 'tecnico',
      technical: 'tecnico',
      funcional: 'funcional',
      functional: 'funcional',
      estrategia: 'estrategia',
      estrategico: 'estrategia',
      estratégico: 'estrategia',
      strategic: 'estrategia',
      strategy: 'estrategia',
    };
    const k = map[slug] ?? (COMPETENCIA_AMBITOS.has(slug) ? slug : '');
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

function normalizeCompetenciaMomentum(raw: unknown): string {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9_]/g, '_');
  const aliases: Record<string, 'bien' | 'neutro' | 'debil' | 'riesgo'> = {
    bien: 'bien',
    fuerte: 'bien',
    positivo: 'bien',
    bien_posicionado: 'bien',
    estable: 'neutro',
    neutro: 'neutro',
    neutral: 'neutro',
    mixto: 'neutro',
    debil: 'debil',
    mal: 'debil',
    mal_posicionado: 'debil',
    debilitado: 'debil',
    riesgo: 'riesgo',
    critico: 'riesgo',
    crtico: 'riesgo',
    en_riesgo: 'riesgo',
    amenaza: 'riesgo',
  };
  return aliases[s] ?? 'neutro';
}

async function recordFact(
  prisma: PrismaService,
  companyId: bigint,
  fieldPath: string,
  value: unknown,
  prev: unknown,
  source: string,
  userId: string | null,
  chatMessageId: bigint | undefined,
) {
  await prisma.kycFact.create({
    data: {
      companyId,
      fieldPath,
      value: toJson(value),
      prevValue: toJson(prev),
      source,
      userId: userId ?? null,
      chatMessageId: chatMessageId != null ? chatMessageId : null,
    },
  });
}

function toJson(v: unknown): Prisma.InputJsonValue {
  if (v === null || v === undefined) {
    return null as unknown as Prisma.InputJsonValue;
  }
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  return JSON.parse(JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x))) as Prisma.InputJsonValue;
}

export function isValidRelType(s: string): s is KycOrgRelationType {
  return (
    s === 'aliado' || s === 'bloqueador' || s === 'influencer' || s === 'mentor' || s === 'rival' || s === 'otro'
  );
}
