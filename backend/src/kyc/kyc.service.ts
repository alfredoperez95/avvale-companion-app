import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KycOpenQuestionStatus, Prisma } from '@prisma/client';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AnthropicCredentialsService } from '../ai-credentials/anthropic/anthropic-credentials.service';
import { AnthropicClientService } from '../yubiq/approve-seal-filler/anthropic-client.service';
import { getKycChatModel, getKycSummaryModel } from './kyc.config';
import { normalizeKycCompanyIndustry } from './kyc-industry.util';
import { buildIntakePrompt, buildResearchPrompt } from './kyc-prompts';
import {
  applyProposedItems,
  canonicalOpenQuestionTopic,
  extractProposedItems,
  isValidRelType,
  normalizeOpenQuestionDedupeKey,
} from './kyc-apply-proposed.util';
import { proposedOpenQuestionsFromPendienteSection } from './kyc-pendiente-section.util';
import {
  companyToApi,
  chatMessageToApi,
  chatSessionToApi,
  completenessFromProfile,
  openQToApi,
  orgMemberToApi,
  orgRelToApi,
  profileToApi,
  signalToApi,
  toApiCompanyListRow,
} from './kyc-mappers';

/** JSON del modelo o texto plano (compatibilidad con respuestas antiguas). */
function parseExecutiveSynthesisResponse(raw: string): {
  summary: string;
  revenue: string | null;
  employees: string | null;
} {
  const strip = (s: string) => s.replace(/^[\s"'«»]+|[\s"'«»]+$/g, '').trim();
  const asParts = (o: unknown): { summary: string; revenue: string | null; employees: string | null } | null => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const r = o as Record<string, unknown>;
    if (typeof r.summary !== 'string') return null;
    const summary = strip(r.summary);
    if (!summary) return null;
    const revenue =
      r.revenue != null && String(r.revenue).trim() ? String(r.revenue).trim().slice(0, 200) : null;
    const employees =
      r.employees != null && String(r.employees).trim() ? String(r.employees).trim().slice(0, 120) : null;
    return { summary, revenue, employees };
  };
  const t = raw.trim();
  try {
    const p = asParts(JSON.parse(t));
    if (p) return p;
  } catch {
    /* fallthrough */
  }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      const p = asParts(JSON.parse(fence[1].trim()));
      if (p) return p;
    } catch {
      /* empty */
    }
  }
  return { summary: strip(t), revenue: null, employees: null };
}

@Injectable()
export class KycService {
  private readonly log = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly creds: AnthropicCredentialsService,
    private readonly anthropic: AnthropicClientService,
  ) {}

  async listCompanies(q: { q?: string; strategic?: string; all?: string } = {}) {
    const { q: search, strategic, all } = q;
    const where: Prisma.KycCompanyWhereInput = {};
    if (all === 'true') {
      if (strategic === 'true') {
        where.profile = { is: { strategic: true } };
      }
    } else {
      if (strategic === 'true') {
        where.profile = { is: { strategic: true } };
      } else {
        where.profile = { is: {} };
      }
    }
    if (search && search.trim()) {
      where.name = { contains: search.trim() };
    }
    const rows = await this.prisma.kycCompany.findMany({
      where,
      take: 500,
      include: { profile: true, _count: { select: { signals: true, orgMembers: true } } },
    });
    const sorted = rows.sort((a, b) => {
      const sa = a.profile?.strategic ? 1 : 0;
      const sb = b.profile?.strategic ? 1 : 0;
      if (sa !== sb) return sb - sa;
      return a.name.localeCompare(b.name);
    });
    return sorted.map((c) => toApiCompanyListRow(c as Parameters<typeof toApiCompanyListRow>[0]));
  }

  async createCompany(
    body: {
      name?: string;
      company_id?: number;
      strategic?: boolean;
      sector?: string;
      industry?: string;
      city?: string;
      country?: string;
      website?: string;
      revenue?: string;
      employees?: string;
      tech_stack?: string;
      notes?: string;
      source?: string;
    },
  ) {
    if (body.company_id != null) {
      const companyId = BigInt(body.company_id);
      const exists = await this.prisma.kycCompany.findUnique({ where: { id: companyId } });
      if (!exists) throw new NotFoundException('Company not found');
      await this.prisma.kycProfile.upsert({
        where: { companyId },
        create: {
          companyId,
          strategic: body.strategic ?? false,
          economics: {},
          businessModel: {},
          customers: {},
          techStack: {},
          criticalProcesses: {},
          sectorContext: {},
          competencia: {},
        },
        update: { strategic: body.strategic ?? undefined },
      });
      return { id: Number(companyId), ok: true };
    }
    const name = (body.name ?? '').trim();
    if (!name) throw new BadRequestException('name required');
    const dup = await this.prisma.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM kyc_companies WHERE LOWER(name) = LOWER(${name}) LIMIT 1
    `;
    let coId: bigint;
    if (dup.length) {
      coId = dup[0].id;
      // Si ya existía por nombre (case-insensitive), actualiza campos proporcionados
      // para que la ficha refleje lo capturado en el alta.
      const data: Prisma.KycCompanyUpdateInput = {};
      const setStr = (v: unknown, field: keyof Prisma.KycCompanyUpdateInput) => {
        if (v === undefined) return;
        (data as Record<string, unknown>)[field as string] =
          v === null || v === '' ? null : typeof v === 'string' ? v : String(v);
      };
      setStr(body.sector, 'sector');
      if (body.industry !== undefined) {
        data.industry = normalizeKycCompanyIndustry(body.industry);
      }
      setStr(body.city, 'city');
      setStr(body.country, 'country');
      setStr(body.website, 'website');
      setStr(body.revenue, 'revenue');
      setStr(body.employees, 'employees');
      setStr(body.tech_stack, 'techStack');
      setStr(body.notes, 'notes');
      setStr(body.source, 'source');
      if (Object.keys(data).length) {
        await this.prisma.kycCompany.update({ where: { id: coId }, data });
      }
    } else {
      const c = await this.prisma.kycCompany.create({
        data: {
          name,
          sector: body.sector ?? null,
          industry: normalizeKycCompanyIndustry(body.industry),
          city: body.city ?? null,
          country: body.country ?? 'Spain',
          website: body.website ?? null,
          revenue: body.revenue ?? null,
          employees: body.employees ?? null,
          techStack: body.tech_stack ?? null,
          notes: body.notes ?? null,
          source: body.source ?? 'kyc',
        },
      });
      coId = c.id;
    }
    await this.prisma.kycProfile.upsert({
      where: { companyId: coId },
      create: {
        companyId: coId,
        strategic: body.strategic ?? false,
        economics: {},
        businessModel: {},
        customers: {},
        techStack: {},
        criticalProcesses: {},
        sectorContext: {},
        competencia: {},
      },
      update: { strategic: body.strategic ?? undefined },
    });

    try {
      await this.fetchNewsSignals(coId);
    } catch (e) {
      this.log.warn('createCompany fetchNewsSignals', (e as Error).message);
    }

    return { id: Number(coId), ok: true };
  }

  async bulkDeleteCompanyProfiles(ids: number[]) {
    const b = ids.map((i) => BigInt(i)).filter((x) => x > 0n);
    if (!b.length) throw new BadRequestException('ids array required');
    await this.prisma.$transaction(async (tx) => {
      for (const companyId of b) {
        await tx.kycFact.deleteMany({ where: { companyId } });
        await tx.kycOpenQuestion.deleteMany({ where: { companyId } });
        await tx.kycChatSession.deleteMany({ where: { companyId } });
        await tx.kycOrgRelationship.deleteMany({ where: { companyId } });
        await tx.kycOrgMember.deleteMany({ where: { companyId } });
        await tx.kycSignal.deleteMany({ where: { companyId } });
        await tx.kycProfile.deleteMany({ where: { companyId } });
      }
    });
    return { deleted: b.length };
  }

  async importCompanies(rows: Record<string, string>[]) {
    if (!Array.isArray(rows) || !rows.length) {
      throw new BadRequestException('companies array required');
    }
    const result = { imported: 0, activated: 0, skipped: 0, errors: [] as { name: string; error: string }[] };
    for (const row of rows) {
      const name = (row.name || '').trim();
      if (!name) {
        result.skipped += 1;
        continue;
      }
      try {
        const dup = await this.prisma.$queryRaw<{ id: bigint }[]>`
          SELECT id FROM kyc_companies WHERE LOWER(name) = LOWER(${name}) LIMIT 1
        `;
        let coId: bigint;
        if (dup.length) {
          coId = dup[0].id;
        } else {
          let industry: string | null = null;
          try {
            industry = row.industry ? normalizeKycCompanyIndustry(row.industry) : null;
          } catch (e) {
            result.errors.push({ name, error: (e as Error).message });
            continue;
          }
          const c = await this.prisma.kycCompany.create({
            data: {
              name,
              sector: row.sector || null,
              industry,
              city: row.city || null,
              country: row.country || 'Spain',
              website: row.website || null,
              revenue: row.revenue || null,
              employees: row.employees || null,
              source: 'kyc-import',
            },
          });
          coId = c.id;
          result.imported += 1;
        }
        const had = await this.prisma.kycProfile.findUnique({ where: { companyId: coId } });
        if (!had) {
          await this.prisma.kycProfile.create({
            data: {
              companyId: coId,
              economics: {},
              businessModel: {},
              customers: {},
              techStack: {},
              criticalProcesses: {},
              sectorContext: {},
              competencia: {},
            },
          });
          result.activated += 1;
        }
      } catch (e) {
        result.errors.push({ name, error: (e as Error).message });
      }
    }
    return result;
  }

  async getFullProfile(companyId: bigint) {
    const co = await this.prisma.kycCompany.findUnique({
      where: { id: companyId },
    });
    if (!co) return null;
    const prof = await this.prisma.kycProfile.findUnique({ where: { companyId: co.id } });
    const members = await this.prisma.kycOrgMember.findMany({
      where: { companyId: co.id },
      orderBy: [{ name: 'asc' }],
    });
    const rels = await this.prisma.kycOrgRelationship.findMany({ where: { companyId: co.id } });
    const signals = await this.prisma.kycSignal.findMany({
      where: { companyId: co.id },
      orderBy: { capturedAt: 'desc' },
      take: 50,
    });
    const openQs = await this.prisma.kycOpenQuestion.findMany({
      where: { companyId: co.id, status: 'open' },
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
    });
    return {
      company: companyToApi(co),
      profile: prof ? profileToApi(prof) : null,
      completeness: prof ? completenessFromProfile(prof) : 0,
      org: { members: members.map(orgMemberToApi), relationships: rels.map(orgRelToApi) },
      signals: signals.map(signalToApi),
      open_questions: openQs.map(openQToApi),
    };
  }

  async getCompanyOrThrow(id: string) {
    const data = await this.getFullProfile(this.id(id));
    if (!data) throw new NotFoundException('Not found');
    return data;
  }

  async patchCompany(companyId: bigint, body: Record<string, unknown>) {
    const exists = await this.prisma.kycCompany.findUnique({ where: { id: companyId } });
    if (!exists) throw new NotFoundException('Company not found');
    const data: Prisma.KycCompanyUpdateInput = {};
    if (body.name !== undefined) {
      const n = String(body.name ?? '').trim();
      if (!n) throw new BadRequestException('name no puede estar vacío');
      data.name = n;
    }
    const setStr = (api: string, field: keyof Prisma.KycCompanyUpdateInput) => {
      if (body[api] === undefined) return;
      const v = body[api];
      (data as Record<string, unknown>)[field as string] =
        v === null || v === '' ? null : typeof v === 'string' ? v : String(v);
    };
    setStr('sector', 'sector');
    if (body.industry !== undefined) {
      data.industry = normalizeKycCompanyIndustry(body.industry);
    }
    setStr('city', 'city');
    setStr('country', 'country');
    setStr('website', 'website');
    setStr('revenue', 'revenue');
    setStr('employees', 'employees');
    setStr('tech_stack', 'techStack');
    setStr('source', 'source');
    setStr('notes', 'notes');
    if (Object.keys(data).length === 0) throw new BadRequestException('No fields');
    const u = await this.prisma.kycCompany.update({ where: { id: companyId }, data });
    return companyToApi(u);
  }

  private id(s: string): bigint {
    try {
      return BigInt(s);
    } catch {
      throw new BadRequestException('id inválido');
    }
  }

  async deleteKycDataForCompany(companyId: bigint) {
    const r = await this.prisma.kycProfile.findUnique({ where: { companyId } });
    if (!r) throw new NotFoundException('Not in KYC');
    await this.prisma.kycFact.deleteMany({ where: { companyId } });
    await this.prisma.kycOpenQuestion.deleteMany({ where: { companyId } });
    await this.prisma.kycChatSession.deleteMany({ where: { companyId } });
    await this.prisma.kycOrgRelationship.deleteMany({ where: { companyId } });
    await this.prisma.kycOrgMember.deleteMany({ where: { companyId } });
    await this.prisma.kycSignal.deleteMany({ where: { companyId } });
    await this.prisma.kycProfile.delete({ where: { companyId } });
    return { ok: true };
  }

  async ensureActivate(companyId: bigint) {
    const co = await this.prisma.kycCompany.findUnique({ where: { id: companyId } });
    if (!co) throw new NotFoundException('Company not found');
    await this.prisma.kycProfile.upsert({
      where: { companyId: co.id },
      create: {
        companyId: co.id,
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
    return { ok: true, company_id: Number(companyId) };
  }

  async patchProfile(companyId: bigint, body: Record<string, unknown>) {
    const exists = await this.prisma.kycCompany.findUnique({ where: { id: companyId } });
    if (!exists) throw new NotFoundException('Company not found');
    await this.prisma.kycProfile.upsert({
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
    const data: Prisma.KycProfileUpdateInput = {};
    const blocks: { api: string; pr: keyof Prisma.KycProfileUpdateInput }[] = [
      { api: 'economics', pr: 'economics' },
      { api: 'business_model', pr: 'businessModel' },
      { api: 'customers', pr: 'customers' },
      { api: 'tech_stack', pr: 'techStack' },
      { api: 'critical_processes', pr: 'criticalProcesses' },
      { api: 'sector_context', pr: 'sectorContext' },
    ];
    for (const { api, pr } of blocks) {
      if (body[api] !== undefined) (data as Record<string, unknown>)[pr as string] = body[api] as object;
    }
    if (body.competencia !== undefined) {
      const c = body.competencia;
      if (c === null || typeof c !== 'object' || Array.isArray(c)) throw new BadRequestException('competencia inválida');
      data.competencia = c as object;
    }
    if (body.summary !== undefined) data.summary = String(body.summary);
    if (body.strategic !== undefined) data.strategic = Boolean(body.strategic);
    if (body.confidence_score !== undefined) data.confidenceScore = Number(body.confidence_score);
    if (Object.keys(data).length === 0) throw new BadRequestException('No fields');
    const updated = await this.prisma.kycProfile.update({ where: { companyId }, data });
    return profileToApi(updated);
  }

  async getTimeline(companyId: bigint) {
    const signals = await this.prisma.kycSignal.findMany({ where: { companyId } });
    const items = signals
      .map((s) => {
        const ts = s.publishedAt ?? s.capturedAt;
        return {
          kind: 'signal' as const,
          id: Number(s.id),
          source: s.source,
          source_url: s.sourceUrl,
          title: s.title,
          text: s.text,
          sentiment: s.sentiment,
          type: s.signalType,
          ts: ts.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return items;
  }

  enrichNotAvailable() {
    return { error: 'enrich (scraping) not available in this build' };
  }

  async getOrg(companyId: bigint) {
    const members = await this.prisma.kycOrgMember.findMany({
      where: { companyId },
      orderBy: [{ name: 'asc' }],
    });
    const rels = await this.prisma.kycOrgRelationship.findMany({ where: { companyId } });
    return { members: members.map(orgMemberToApi), relationships: rels.map(orgRelToApi) };
  }

  async addOrgMember(companyId: bigint, body: Record<string, unknown>) {
    if (!body.name) throw new BadRequestException('name required');
    const m = await this.prisma.kycOrgMember.create({
      data: {
        companyId,
        name: String(body.name),
        role: (body.role as string) || null,
        area: (body.area as string) || null,
        level: body.level != null ? Number(body.level) : null,
        reportsToId: body.reports_to_id != null ? BigInt(String(body.reports_to_id)) : null,
        linkedin: (body.linkedin as string) || null,
        notes: (body.notes as string) || null,
        contactId: body.contact_id != null ? BigInt(String(body.contact_id)) : null,
        source: (body.source as string) || 'manual',
      },
    });
    return orgMemberToApi(m);
  }

  async patchMember(memberId: bigint, body: Record<string, unknown>) {
    const d: Prisma.KycOrgMemberUpdateInput = {};
    for (const k of ['name', 'role', 'area', 'level', 'linkedin', 'notes'] as const) {
      if (body[k] !== undefined) (d as Record<string, unknown>)[k] = body[k];
    }
    if (body.reports_to_id !== undefined) {
      d.reportsTo =
        body.reports_to_id == null
          ? { disconnect: true }
          : { connect: { id: BigInt(String(body.reports_to_id)) } };
    }
    if (body.contact_id !== undefined) {
      d.contact =
        body.contact_id == null
          ? { disconnect: true }
          : { connect: { id: BigInt(String(body.contact_id)) } };
    }
    if (Object.keys(d).length === 0) throw new BadRequestException('No fields');
    const m = await this.prisma.kycOrgMember.update({ where: { id: memberId }, data: d });
    return orgMemberToApi(m);
  }

  async deleteMember(memberId: bigint) {
    const r = await this.prisma.kycOrgMember.delete({ where: { id: memberId } });
    if (!r) throw new NotFoundException('Not found');
    return { ok: true };
  }

  async addRelationship(companyId: bigint, body: Record<string, unknown>) {
    if (!body.from_member_id || !body.to_member_id || !body.type) {
      throw new BadRequestException('from_member_id, to_member_id, type required');
    }
    const t = String(body.type);
    if (!isValidRelType(t)) throw new BadRequestException('invalid rel type');
    const r = await this.prisma.kycOrgRelationship.create({
      data: {
        companyId,
        fromMemberId: BigInt(String(body.from_member_id)),
        toMemberId: BigInt(String(body.to_member_id)),
        type: t,
        strength: body.strength != null ? Number(body.strength) : 3,
        notes: (body.notes as string) || null,
      },
    });
    return orgRelToApi(r);
  }

  async deleteRel(relId: bigint) {
    await this.prisma.kycOrgRelationship.delete({ where: { id: relId } });
    return { ok: true };
  }

  async getSignals(companyId: bigint) {
    const rows = await this.prisma.kycSignal.findMany({
      where: { companyId },
      orderBy: { capturedAt: 'desc' },
      take: 200,
    });
    return rows.map(signalToApi);
  }

  async addSignal(companyId: bigint, body: Record<string, unknown>) {
    const s = await this.prisma.kycSignal.create({
      data: {
        companyId,
        source: (body.source as string) || 'manual',
        sourceUrl: (body.source_url as string) || null,
        sentiment: (body.sentiment as 'positive' | 'neutral' | 'negative' | 'mixed' | null) ?? null,
        rating: body.rating != null ? new Prisma.Decimal(String(body.rating)) : null,
        title: (body.title as string) || null,
        text: (body.text as string) || null,
        signalType: (body.signal_type as string) || 'note',
        publishedAt: body.published_at ? new Date(String(body.published_at)) : null,
      },
    });
    return signalToApi(s);
  }

  async fetchNewsSignals(companyId: bigint) {
    const co = await this.prisma.kycCompany.findUnique({ where: { id: companyId } });
    if (!co) throw new NotFoundException('Company not found');
    const q = encodeURIComponent(String(co.name || '').trim());
    if (!q) throw new BadRequestException('name required');

    // RSS público de Google News. Nota: puede variar por región/idioma.
    const url = `https://news.google.com/rss/search?q=${q}&hl=es&gl=ES&ceid=ES:es`;
    const r = await fetch(url, {
      headers: {
        // Algunos endpoints responden mejor con UA explícito.
        'User-Agent': 'AvvaleCompanionKYC/1.0 (+rss)',
        Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
      },
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new BadRequestException(t || `HTTP ${r.status}`);
    }
    const xml = await r.text();
    const items = parseRssItems(xml).slice(0, 20);

    // Dedupe por URL.
    const existing = await this.prisma.kycSignal.findMany({
      where: { companyId, source: 'google_news' },
      select: { sourceUrl: true },
      take: 500,
    });
    const seen = new Set(existing.map((e) => e.sourceUrl).filter(Boolean) as string[]);

    let created = 0;
    for (const it of items) {
      if (!it.link) continue;
      if (seen.has(it.link)) continue;
      seen.add(it.link);
      let publishedAt: Date | null = null;
      if (it.pubDate && String(it.pubDate).trim()) {
        const d = new Date(it.pubDate);
        if (!Number.isNaN(d.getTime())) publishedAt = d;
      }
      await this.prisma.kycSignal.create({
        data: {
          companyId,
          source: 'google_news',
          sourceUrl: it.link,
          sentiment: null,
          rating: null,
          title: it.title || null,
          text: it.description || null,
          signalType: 'news',
          publishedAt,
        },
      });
      created += 1;
    }

    await this.prisma.kycProfile.updateMany({
      where: { companyId },
      data: { lastEnrichedAt: new Date() },
    });

    return { ok: true, created, total: items.length, url };
  }

  async getOpenQuestions(companyId: bigint, status = 'open') {
    const valid: KycOpenQuestionStatus[] = ['open', 'resolved', 'skipped'];
    const st = (valid as string[]).includes(status) ? (status as KycOpenQuestionStatus) : 'open';
    return this.prisma.kycOpenQuestion
      .findMany({
        where: { companyId, status: st },
        orderBy: [{ priority: 'asc' }, { id: 'asc' }],
      })
      .then((r) => r.map(openQToApi));
  }

  async addOpenQuestion(companyId: bigint, body: Record<string, unknown>) {
    if (!body.question) throw new BadRequestException('question required');
    const qText = String(body.question).trim();
    const dedupe = normalizeOpenQuestionDedupeKey(qText);
    if (dedupe) {
      const openQs = await this.prisma.kycOpenQuestion.findMany({
        where: { companyId, status: 'open' },
        select: { question: true },
      });
      if (openQs.some((r) => normalizeOpenQuestionDedupeKey(r.question) === dedupe)) {
        throw new BadRequestException('Ya existe una pregunta abierta igual o muy similar');
      }
    }
    const topic = canonicalOpenQuestionTopic((body.topic as string) || 'general');
    const r = await this.prisma.kycOpenQuestion.create({
      data: {
        companyId,
        topic,
        question: qText,
        priority: body.priority != null ? Number(body.priority) : 2,
        source: (body.source as string) || 'manual',
      },
    });
    return openQToApi(r);
  }

  async patchOpenQuestion(oid: bigint, body: Record<string, unknown>) {
    const existing = await this.prisma.kycOpenQuestion.findUnique({ where: { id: oid } });
    if (!existing) throw new NotFoundException('Open question not found');
    const d: Prisma.KycOpenQuestionUpdateInput = {};
    for (const k of ['question', 'topic', 'priority', 'answer'] as const) {
      if (body[k] !== undefined) (d as Record<string, unknown>)[k] = body[k];
    }
    if (body.status !== undefined) {
      d.status = body.status as KycOpenQuestionStatus;
      if (d.status === 'resolved' || d.status === 'skipped') {
        d.resolvedAt = new Date();
      }
    }
    if (body.topic !== undefined) {
      d.topic = canonicalOpenQuestionTopic(String(body.topic));
    }
    if (Object.keys(d).length === 0) throw new BadRequestException('No fields');
    const u = await this.prisma.kycOpenQuestion.update({ where: { id: oid }, data: d });

    const resolved = u.status === 'resolved';
    const applyToProfile = body.apply_to_profile === true || body.apply_to_profile === 'true';
    if (resolved && applyToProfile) {
      const ans = String((body.answer !== undefined ? body.answer : u.answer) ?? '').trim();
      if (ans) {
        let fp = typeof body.apply_field_path === 'string' ? body.apply_field_path.trim() : '';
        if (!fp) {
          const top = canonicalOpenQuestionTopic(u.topic);
          const profileBlocks = new Set([
            'economics',
            'business_model',
            'customers',
            'tech_stack',
            'critical_processes',
            'sector_context',
          ]);
          if (profileBlocks.has(top)) fp = `${top}.interview_answer`;
        }
        if (fp) {
          const val = body.apply_value !== undefined ? body.apply_value : ans;
          try {
            await applyProposedItems(this.prisma, existing.companyId, null, [
              { field_path: fp, value: val as unknown, source: 'manual_resolve' },
            ]);
          } catch (e) {
            this.log.warn('patchOpenQuestion apply profile', (e as Error).message);
          }
        }
      }
    }

    return openQToApi(u);
  }

  async deleteOpenQuestion(oid: bigint) {
    await this.prisma.kycOpenQuestion.delete({ where: { id: oid } });
    return { ok: true };
  }

  async getChatSessions(companyId: bigint) {
    const s = await this.prisma.kycChatSession.findMany({ where: { companyId }, orderBy: { updatedAt: 'desc' } });
    return s.map(chatSessionToApi);
  }

  async createChatSession(companyId: bigint, userId: string | null, body: { title?: string; type?: string }) {
    const t = (body.type || '').toLowerCase() === 'intake' ? 'intake' : 'research';
    const isIntake = t === 'intake';
    const defaultTitle = isIntake ? 'Entrevista guiada' : 'Investigación KYC';
    const s = await this.prisma.kycChatSession.create({
      data: {
        companyId,
        title: (body.title as string) || defaultTitle,
        sessionType: isIntake ? 'intake' : 'research',
        userId: userId ?? null,
        workdir: null,
      },
    });
    return chatSessionToApi(s);
  }

  async getChatMessages(sessionId: bigint) {
    const rows = await this.prisma.kycChatMessage.findMany({ where: { sessionId }, orderBy: { id: 'asc' } });
    return rows.map((m) => {
      const o = chatMessageToApi(m);
      return { id: o.id, role: o.role, content: o.content, meta: o.meta, created_at: o.created_at };
    });
  }

  private async buildContextMarkdown(companyId: bigint): Promise<string> {
    const d = await this.getFullProfile(companyId);
    if (!d) return '';
    const lines: string[] = [];
    const { company, profile, completeness, org, signals, open_questions } = d;
    lines.push(`# KYC — ${company.name}`);
    lines.push(`**id:** ${company.id}`);
    lines.push(`**Industria:** ${(company as Record<string, unknown>).industry ?? '—'}`);
    lines.push(`**Sector / ciudad:** ${company.sector ?? '—'} · ${company.city ?? '—'}`);
    lines.push(`**Web / revenue / empleados:** ${company.website ?? '—'} · ${company.revenue ?? '—'} · ${company.employees ?? '—'}`);
    lines.push('');
    if (profile) {
      lines.push(`**Completado:** ${completeness}%`);
      lines.push(`**Resumen:** ${profile.summary ?? '—'}`);
      const prof = profile as Record<string, unknown>;
      const payload = {
        economics: prof.economics,
        business_model: prof.business_model,
        customers: prof.customers,
        tech_stack: prof.tech_stack,
        critical_processes: prof.critical_processes,
        sector_context: prof.sector_context,
        competencia: prof.competencia,
      };
      try {
        let json = JSON.stringify(payload);
        if (json.length > 2 && json !== '{}') {
          lines.push('');
          lines.push('## Bloques de perfil KYC (JSON; úsalo para coherencia y para actualizar **summary** si procede)');
          if (json.length > 14000) json = `${json.slice(0, 14000)}…`;
          lines.push(json);
        }
      } catch {
        /* empty */
      }
    } else {
      lines.push('_(KYC aún no activo para esta empresa)._');
    }
    lines.push('');
    if (org?.members?.length) {
      lines.push('## Organigrama (miembros)');
      for (const m of org.members) {
        lines.push(`- ${m.name} — ${m.role || '—'} (id=${m.id})`);
      }
      lines.push('');
    }
    if (signals?.length) {
      lines.push('## Señales recientes');
      for (const s of (signals as { source: string; title: string; text: string; sentiment: string }[]).slice(0, 10)) {
        lines.push(`- [${s.source}] ${(s as { title?: string }).title || s.text?.slice(0, 100) || '—'}`);
      }
      lines.push('');
    }
    if (open_questions?.length) {
      lines.push('## Preguntas abiertas');
      for (const q of open_questions as { topic: string; question: string }[]) {
        lines.push(`- [${q.topic}] ${q.question}`);
      }
    }
    return lines.join('\n');
  }

  private buildExecutiveSummarySourceMarkdown(d: NonNullable<Awaited<ReturnType<KycService['getFullProfile']>>>): string {
    const lines: string[] = [];
    const { company, profile, org, signals, open_questions } = d;
    const co = company as Record<string, unknown>;

    lines.push('## Ficha de empresa (datos generales)');
    lines.push(`- **Nombre:** ${co.name ?? '—'}`);
    lines.push(`- **Industria (catálogo app):** ${co.industry ?? '—'}`);
    lines.push(`- **Sector (texto libre):** ${co.sector ?? '—'}`);
    lines.push(`- **Ciudad / país:** ${co.city ?? '—'} · ${co.country ?? '—'}`);
    lines.push(`- **Web:** ${co.website ?? '—'}`);
    lines.push(`- **Revenue / empleados:** ${co.revenue ?? '—'} · ${co.employees ?? '—'}`);
    lines.push(`- **Stack (texto en ficha):** ${co.tech_stack ?? '—'}`);
    lines.push(`- **Origen:** ${co.source ?? '—'}`);
    const notes = String(co.notes ?? '').trim();
    if (notes) lines.push(`- **Notas de ficha:** ${notes}`);
    lines.push('');

    if (!profile) {
      lines.push('_(Sin perfil KYC activo.)_');
      return lines.join('\n');
    }

    const prof = profile as Record<string, unknown>;
    lines.push('## Resumen ejecutivo actual (referencia)');
    lines.push(String(prof.summary ?? '').trim() || '_(vacío)_');
    lines.push('');

    const blockLabel: Record<string, string> = {
      economics: 'Economía',
      business_model: 'Modelo de negocio',
      customers: 'Clientes',
      tech_stack: 'Stack tecnológico (perfil)',
      critical_processes: 'Procesos críticos',
      sector_context: 'Contexto sector',
      competencia: 'Competencia / partners',
    };

    lines.push('## Perfil KYC (conocimiento de entrevista, chat y edición)');
    for (const [key, label] of Object.entries(blockLabel)) {
      const v = prof[key];
      if (v == null) continue;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
      lines.push(`### ${label}`);
      lines.push('```json');
      try {
        let s = JSON.stringify(v, null, 2);
        if (s.length > 14000) s = `${s.slice(0, 14000)}\n…(truncado)`;
        lines.push(s);
      } catch {
        lines.push(String(v));
      }
      lines.push('```');
      lines.push('');
    }

    if (org?.members?.length) {
      lines.push('## Organigrama (extracto)');
      for (const m of org.members.slice(0, 25)) {
        lines.push(`- ${m.name} — ${m.role || '—'} (${m.area || '—'})`);
      }
      if (org.members.length > 25) lines.push(`- …y ${org.members.length - 25} personas más`);
      lines.push('');
    }

    if (signals?.length) {
      lines.push('## Señales recientes (extracto)');
      for (const s of signals.slice(0, 12)) {
        const sig = s as { source?: string; title?: string; text?: string };
        const t = (sig.title || sig.text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
        lines.push(`- [${sig.source || '—'}] ${t || '—'}`);
      }
      lines.push('');
    }

    if (open_questions?.length) {
      lines.push('## Preguntas abiertas (lagunas)');
      for (const q of (open_questions as { topic: string; question: string }[]).slice(0, 10)) {
        lines.push(`- [${q.topic}] ${q.question}`);
      }
    }

    let out = lines.join('\n');
    if (out.length > 95000) out = `${out.slice(0, 95000)}\n\n…(contexto truncado)`;
    return out;
  }

  async synthesizeExecutiveSummary(companyId: bigint, userId: string) {
    const d = await this.getFullProfile(companyId);
    if (!d) throw new NotFoundException('Company not found');
    if (!d.profile) throw new BadRequestException('Activa KYC para esta empresa antes de generar el resumen');

    let apiKey: string;
    try {
      apiKey = await this.creds.getApiKeyPlainOrThrow(userId);
    } catch {
      throw new BadRequestException('Configura tu clave de API de Anthropic en el perfil para generar el resumen con IA.');
    }

    const userContent = this.buildExecutiveSummarySourceMarkdown(d);
    const system = `Eres un analista KYC. Con el contexto que recibes debes producir **solo un objeto JSON válido** (sin markdown, sin texto antes ni después, sin bloques \`\`\`).

El JSON debe tener exactamente estas claves:
- "summary": string. Resumen ejecutivo de la cuenta en español para dirección comercial. Integra ficha, perfil KYC (bloques), y si aporta valor organigrama, señales y preguntas abiertas (lagunas breves al final si procede). Máximo ~130 palabras. Tono profesional. **Solo texto corrido**, sin viñetas ni markdown dentro del string.
- "revenue": string | null. Ingresos o facturación **solo** si constan de forma explícita en el contexto (ficha, bloques JSON, señales). Cadena muy breve (p. ej. "50 M€"). Si no hay dato fiable, null.
- "employees": string | null. Número o rango de empleados **solo** si consta de forma explícita en el contexto. Cadena breve (p. ej. "250", "500–1000"). Si no hay dato fiable, null.

Reglas:
- No inventes cifras, empleados ni hechos que no aparezcan en los datos.
- Si la ficha ya incluye revenue o employees y no hay información adicional, puedes devolver esos mismos valores en el JSON o null en esa clave.
- Si hay un resumen previo, el campo "summary" debe reflejar mejor la ficha y el perfil actuales.`;

    const model = getKycSummaryModel(this.config);
    let raw: string;
    let modelId: string;
    try {
      const r = await this.anthropic.completeMessages({
        apiKey,
        model,
        system,
        messages: [{ role: 'user', content: userContent }],
        maxTokens: 1200,
      });
      raw = r.text.trim();
      modelId = r.modelId;
    } catch (e) {
      this.log.warn('synthesizeExecutiveSummary', (e as Error).message);
      throw new BadRequestException(`No se pudo generar el resumen: ${(e as Error).message}`);
    }

    const parsed = parseExecutiveSynthesisResponse(raw);
    if (!parsed.summary) throw new BadRequestException('El modelo devolvió un resumen vacío');

    await applyProposedItems(this.prisma, companyId, userId, [
      { field_path: 'summary', value: parsed.summary, source: 'synthesis' },
    ]);

    const coApi = d.company as Record<string, unknown>;
    const curRev = String(coApi.revenue ?? '').trim();
    const curEmp = String(coApi.employees ?? '').trim();
    const companyPatch: Prisma.KycCompanyUpdateInput = {};
    if (!curRev && parsed.revenue) companyPatch.revenue = parsed.revenue;
    if (!curEmp && parsed.employees) companyPatch.employees = parsed.employees;
    if (Object.keys(companyPatch).length > 0) {
      await this.prisma.kycCompany.update({ where: { id: companyId }, data: companyPatch });
    }

    await this.prisma.kycProfile.update({
      where: { companyId },
      data: { lastEnrichedAt: new Date() },
    });

    return {
      summary: parsed.summary,
      model_id: modelId,
      revenue_filled: Boolean(companyPatch.revenue),
      employees_filled: Boolean(companyPatch.employees),
    };
  }

  async streamChat(sessionId: bigint, userId: string, res: Response, userMessage: string) {
    let apiKey: string;
    try {
      apiKey = await this.creds.getApiKeyPlainOrThrow(userId);
    } catch {
      res.status(400).json({ error: 'Falta la clave de API de Anthropic. Configúrala en el perfil.' });
      return;
    }
    const s = await this.prisma.kycChatSession.findUnique({ where: { id: sessionId } });
    if (!s) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const msg = userMessage.trim();
    if (!msg) {
      res.status(400).json({ error: 'message required' });
      return;
    }
    const uRow = await this.prisma.kycChatMessage.create({
      data: { sessionId, role: 'user', content: msg },
    });
    const uMsg = chatMessageToApi(uRow);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const sse = (ev: string, data: object) => {
      res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    sse('start', { session_id: Number(sessionId), user_message_id: uMsg.id });
    const companyId = s.companyId;
    const contextMd = await this.buildContextMarkdown(companyId);
    const history = await this.prisma.kycChatMessage.findMany({ where: { sessionId }, orderBy: { id: 'asc' } });
    const past = history.filter((m) => m.id !== uRow.id);
    const historyBlock = past.length
      ? past.map((m) => `### ${m.role === 'user' ? 'Usuario' : 'Asistente'}\n${m.content}`).join('\n\n')
      : '_(sin mensajes previos)_';
    const isIntake = s.sessionType === 'intake';
    const built = isIntake
      ? buildIntakePrompt(String(companyId), contextMd, historyBlock, msg)
      : buildResearchPrompt(String(companyId), contextMd, historyBlock, msg);
    const model = getKycChatModel(this.config);
    let full = '';
    try {
      const stream = this.anthropic.streamMessageTextDeltas({
        apiKey,
        model,
        system: built.system,
        messages: [{ role: 'user', content: built.user }],
        maxTokens: 4096,
      });
      for await (const t of stream) {
        if (t) {
          full += t;
          sse('chunk', { text: t });
        }
      }
    } catch (e) {
      this.log.error(e);
      sse('error', { error: (e as Error).message });
      res.end();
      return;
    }
    const items = extractProposedItems(full);
    const fromPendiente = proposedOpenQuestionsFromPendienteSection(full);
    const merged = [...items, ...fromPendiente];
    let applied = 0;
    const asst = await this.prisma.kycChatMessage.create({
      data: { sessionId, role: 'assistant', content: full, meta: { updates_applied: 0, exit_code: 0 } },
    });
    if (merged.length) {
      try {
        applied = await applyProposedItems(this.prisma, companyId, userId, merged, asst.id);
        await this.prisma.kycChatMessage.update({ where: { id: asst.id }, data: { meta: { exit_code: 0, updates_applied: applied } } });
      } catch (e) {
        this.log.warn('apply proposed', (e as Error).message);
      }
    }
    await this.prisma.kycChatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
    sse('done', { exit_code: 0, updates_applied: applied });
    res.end();
  }
}

function parseRssItems(xml: string): { title: string; link: string; pubDate: string; description: string }[] {
  const items: { title: string; link: string; pubDate: string; description: string }[] = [];
  const blocks = xml.split(/<item>/i).slice(1);
  for (const b of blocks) {
    const chunk = b.split(/<\/item>/i)[0] || '';
    const title = decodeXml(getTag(chunk, 'title'));
    const link = decodeXml(getTag(chunk, 'link'));
    const pubDate = decodeXml(getTag(chunk, 'pubDate'));
    const descRaw = decodeXml(getTag(chunk, 'description'));
    const description = stripHtml(descRaw).trim();
    items.push({ title, link, pubDate, description });
  }
  return items;
}

function getTag(xml: string, tag: string) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  return (m[1] || '').replace(/^<!\\[CDATA\\[|\\]\\]>$/g, '').trim();
}

function stripHtml(s: string) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ');
}

function decodeXml(s: string) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
