import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { MeddpiccDeal, MeddpiccDealAttachment } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnthropicCredentialsService } from '../ai-credentials/anthropic/anthropic-credentials.service';
import { AnthropicClientService } from '../yubiq/approve-seal-filler/anthropic-client.service';
import { UserPayload } from '../auth/decorators/user-payload';
import { CreateMeddpiccDealDto } from './dto/create-meddpicc-deal.dto';
import { UpdateMeddpiccDealDto } from './dto/update-meddpicc-deal.dto';
import { AnalyzeMeddpiccDealDto } from './dto/analyze-meddpicc-deal.dto';
import { buildMeddpiccUserPrompt, MEDDPICC_SYSTEM } from './meddpicc.constants';
import { getMeddpiccModel } from './meddpicc.config';
import { buildCombinedDealContextForPrompt } from './meddpicc-context';
import { MeddpiccStorageService } from './meddpicc-storage.service';
import { MeddpiccExtractService } from './meddpicc-extract.service';

const MAX_ATTACHMENTS_PER_DEAL = 25;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type DealWithUser = MeddpiccDeal & {
  user: { id: string; email: string; name: string | null; lastName: string | null };
  attachments?: MeddpiccDealAttachment[];
};

function isAdmin(role: string): boolean {
  return role === 'ADMIN';
}

function asStringRecord(json: Prisma.JsonValue | null | undefined): Record<string, string> {
  if (json == null || typeof json !== 'object' || Array.isArray(json)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(json)) {
    if (v != null && typeof v !== 'object') out[k] = String(v);
  }
  return out;
}

function asNumberRecord(json: Prisma.JsonValue | null | undefined): Record<string, number> {
  if (json == null || typeof json !== 'object' || Array.isArray(json)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(json)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function asNotesRecord(json: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (json == null || typeof json !== 'object' || Array.isArray(json)) return {};
  return { ...json } as Record<string, unknown>;
}

@Injectable()
export class MeddpiccService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly creds: AnthropicCredentialsService,
    private readonly anthropic: AnthropicClientService,
    private readonly storage: MeddpiccStorageService,
    private readonly extract: MeddpiccExtractService,
  ) {}

  private async loadDealOrThrow(id: string, opts?: { includeAttachments?: boolean }): Promise<DealWithUser> {
    const deal = await this.prisma.meddpiccDeal.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, lastName: true } },
        ...(opts?.includeAttachments
          ? { attachments: { orderBy: { sortOrder: 'asc' as const } } }
          : {}),
      },
    });
    if (!deal) throw new NotFoundException('Deal no encontrado');
    return deal as DealWithUser;
  }

  private assertCanAccess(actor: UserPayload, dealUserId: string) {
    if (!isAdmin(actor.role) && dealUserId !== actor.userId) {
      throw new ForbiddenException('No tienes permiso para este deal');
    }
  }

  private formatCommercialLabel(deal: { ownerLabel: string | null }, user: { name: string | null; lastName: string | null }) {
    if (deal.ownerLabel?.trim()) return deal.ownerLabel.trim();
    const parts = [user.name, user.lastName].filter(Boolean);
    return parts.length ? parts.join(' ') : 'Usuario';
  }

  private serializeDeal(deal: DealWithUser, opts?: { includeOwner?: boolean }) {
    const base = {
      id: deal.id,
      userId: deal.userId,
      name: deal.name,
      company: deal.company,
      ownerLabel: deal.ownerLabel,
      value: deal.value,
      context: deal.context,
      scores: deal.scores,
      answers: deal.answers,
      notes: deal.notes,
      status: deal.status,
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
    };
    const withOwner =
      opts?.includeOwner !== false
        ? {
            ...base,
            owner: {
              email: deal.user.email,
              name: deal.user.name,
              lastName: deal.user.lastName,
            },
          }
        : base;
    if (deal.attachments && deal.attachments.length > 0) {
      return {
        ...withOwner,
        attachments: deal.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          extractedMarkdown: a.extractedMarkdown,
          sortOrder: a.sortOrder,
          createdAt: a.createdAt,
        })),
      };
    }
    return withOwner;
  }

  async list(
    actor: UserPayload,
    query: { status?: string; userId?: string },
  ): Promise<{ deals: ReturnType<MeddpiccService['serializeDeal']>[] }> {
    const status = query.status?.trim() || 'active';
    const where: Prisma.MeddpiccDealWhereInput = { status };
    if (!isAdmin(actor.role)) {
      where.userId = actor.userId;
    } else if (query.userId?.trim()) {
      where.userId = query.userId.trim();
    }

    const rows = await this.prisma.meddpiccDeal.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true, lastName: true } },
      },
    });
    return { deals: rows.map((d) => this.serializeDeal(d as Awaited<ReturnType<MeddpiccService['loadDealOrThrow']>>)) };
  }

  async stats(actor: UserPayload): Promise<{
    total: number;
    byUser: { userId: string; email: string; name: string | null; lastName: string | null; count: number }[];
  }> {
    const baseWhere: Prisma.MeddpiccDealWhereInput = { status: 'active' };
    if (!isAdmin(actor.role)) {
      baseWhere.userId = actor.userId;
    }

    const total = await this.prisma.meddpiccDeal.count({ where: baseWhere });

    const grouped = await this.prisma.meddpiccDeal.groupBy({
      by: ['userId'],
      where: baseWhere,
      _count: { _all: true },
    });

    const userIds = grouped.map((g) => g.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true, lastName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const byUser = grouped.map((g) => {
      const u = userMap.get(g.userId);
      return {
        userId: g.userId,
        email: u?.email ?? '',
        name: u?.name ?? null,
        lastName: u?.lastName ?? null,
        count: g._count._all,
      };
    });

    return { total, byUser };
  }

  async getOne(actor: UserPayload, id: string) {
    const deal = await this.loadDealOrThrow(id, { includeAttachments: true });
    this.assertCanAccess(actor, deal.userId);
    const history = await this.prisma.meddpiccHistory.findMany({
      where: { dealId: id },
      orderBy: { createdAt: 'desc' },
    });
    return {
      deal: this.serializeDeal(deal),
      history: history.map((h) => ({
        id: h.id.toString(),
        dealId: h.dealId,
        dimension: h.dimension,
        score: h.score,
        note: h.note,
        createdAt: h.createdAt,
      })),
    };
  }

  async create(actor: UserPayload, dto: CreateMeddpiccDealDto) {
    let targetUserId = actor.userId;
    if (dto.forUserId) {
      if (!isAdmin(actor.role)) {
        throw new ForbiddenException('Solo administradores pueden asignar el deal a otro usuario');
      }
      const u = await this.prisma.user.findUnique({ where: { id: dto.forUserId } });
      if (!u) throw new BadRequestException('Usuario destino no encontrado');
      targetUserId = dto.forUserId;
    }

    const deal = await this.prisma.meddpiccDeal.create({
      data: {
        userId: targetUserId,
        name: dto.name.trim(),
        company: dto.company?.trim() ?? '',
        ownerLabel: dto.ownerLabel?.trim() || null,
        value: dto.value?.trim() ?? '',
        context: dto.context?.trim() ?? null,
        scores: {},
        answers: {},
        notes: {},
        status: 'active',
      },
      include: {
        user: { select: { id: true, email: true, name: true, lastName: true } },
      },
    });
    return { deal: this.serializeDeal(deal as Awaited<ReturnType<MeddpiccService['loadDealOrThrow']>>) };
  }

  async update(actor: UserPayload, id: string, dto: UpdateMeddpiccDealDto) {
    const existing = await this.loadDealOrThrow(id);
    this.assertCanAccess(actor, existing.userId);

    const oldScores = asNumberRecord(existing.scores);
    const newScores = dto.scores != null ? { ...oldScores, ...dto.scores } : undefined;

    if (dto.scores != null) {
      const note = dto.scoreChangeNote?.trim() || null;
      for (const dim of Object.keys(dto.scores)) {
        if (dto.scores[dim] !== oldScores[dim]) {
          await this.prisma.meddpiccHistory.create({
            data: {
              dealId: id,
              dimension: dim,
              score: dto.scores[dim] ?? null,
              note,
            },
          });
        }
      }
    }

    const nextScores = newScores ?? asNumberRecord(existing.scores);
    const nextAnswers =
      dto.answers != null ? { ...asStringRecord(existing.answers), ...dto.answers } : asStringRecord(existing.answers);
    const nextNotes =
      dto.notes != null
        ? { ...asNotesRecord(existing.notes), ...dto.notes }
        : asNotesRecord(existing.notes);

    const deal = await this.prisma.meddpiccDeal.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? existing.name,
        company: dto.company !== undefined ? dto.company.trim() : existing.company,
        ownerLabel:
          dto.ownerLabel === undefined
            ? existing.ownerLabel
            : dto.ownerLabel === null
              ? null
              : dto.ownerLabel.trim() || null,
        value: dto.value !== undefined ? dto.value.trim() : existing.value,
        context: dto.context === undefined ? existing.context : dto.context,
        scores: nextScores as unknown as Prisma.InputJsonValue,
        answers: nextAnswers as unknown as Prisma.InputJsonValue,
        notes: nextNotes as unknown as Prisma.InputJsonValue,
        status: dto.status?.trim() ?? existing.status,
      },
      include: {
        user: { select: { id: true, email: true, name: true, lastName: true } },
        attachments: { orderBy: { sortOrder: 'asc' } },
      },
    });
    return { deal: this.serializeDeal(deal as DealWithUser) };
  }

  async remove(actor: UserPayload, id: string) {
    const existing = await this.loadDealOrThrow(id);
    this.assertCanAccess(actor, existing.userId);
    await this.prisma.meddpiccDeal.delete({ where: { id } });
    await this.storage.deleteDealFolder(id).catch(() => undefined);
    return { ok: true as const };
  }

  async addAttachments(actor: UserPayload, dealId: string, files: Express.Multer.File[]) {
    const deal = await this.loadDealOrThrow(dealId);
    this.assertCanAccess(actor, deal.userId);
    const list = files?.filter((f) => f?.buffer?.length) ?? [];
    if (list.length === 0) throw new BadRequestException('No se recibió ningún archivo');

    const currentCount = await this.prisma.meddpiccDealAttachment.count({ where: { dealId } });
    if (currentCount + list.length > MAX_ATTACHMENTS_PER_DEAL) {
      throw new BadRequestException(`Máximo ${MAX_ATTACHMENTS_PER_DEAL} adjuntos por deal`);
    }

    let order =
      (
        await this.prisma.meddpiccDealAttachment.findFirst({
          where: { dealId },
          orderBy: { sortOrder: 'desc' },
          select: { sortOrder: true },
        })
      )?.sortOrder ?? -1;

    for (const file of list) {
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new BadRequestException(`El archivo «${file.originalname}» supera el máximo de 25 MB`);
      }
      const md = await this.extract.extractToMarkdown(
        file.buffer,
        file.originalname || 'documento',
        file.mimetype || 'application/octet-stream',
      );
      const saved = await this.storage.saveUploadedFile(dealId, {
        buffer: file.buffer,
        originalname: file.originalname || 'documento',
        mimetype: file.mimetype || 'application/octet-stream',
      });
      order += 1;
      await this.prisma.meddpiccDealAttachment.create({
        data: {
          dealId,
          fileName: saved.fileName,
          mimeType: saved.mimeType,
          storagePath: saved.storedPath,
          extractedMarkdown: md,
          sortOrder: order,
        },
      });
    }

    const fresh = await this.loadDealOrThrow(dealId, { includeAttachments: true });
    return { deal: this.serializeDeal(fresh), added: list.length };
  }

  async removeAttachment(actor: UserPayload, dealId: string, attachmentId: string) {
    const deal = await this.loadDealOrThrow(dealId);
    this.assertCanAccess(actor, deal.userId);
    const att = await this.prisma.meddpiccDealAttachment.findFirst({
      where: { id: attachmentId, dealId },
    });
    if (!att) throw new NotFoundException('Adjunto no encontrado');
    await this.storage.deleteFile(att.storagePath);
    await this.prisma.meddpiccDealAttachment.delete({ where: { id: attachmentId } });
    const fresh = await this.loadDealOrThrow(dealId, { includeAttachments: true });
    return { deal: this.serializeDeal(fresh) };
  }

  async analyze(actor: UserPayload, id: string, dto: AnalyzeMeddpiccDealDto) {
    const deal = await this.loadDealOrThrow(id, { includeAttachments: true });
    this.assertCanAccess(actor, deal.userId);

    /** Clave del usuario autenticado (perfil → AI Credentials), no la del propietario del deal. */
    let apiKey: string;
    try {
      apiKey = await this.creds.getApiKeyPlainOrThrow(actor.userId);
    } catch {
      throw new NotFoundException(
        'No hay clave Anthropic configurada en tu perfil. Añádela en Perfil → AI Credentials.',
      );
    }

    const currentAnswers = asStringRecord(deal.answers);
    const currentScores = asNumberRecord(deal.scores);
    const commercialLabel = this.formatCommercialLabel(deal, deal.user);

    const contextForPrompt = buildCombinedDealContextForPrompt(
      deal.context,
      (deal.attachments ?? []).map((a) => ({
        fileName: a.fileName,
        extractedMarkdown: a.extractedMarkdown,
      })),
    );

    const userPrompt = buildMeddpiccUserPrompt({
      name: deal.name,
      company: deal.company,
      commercialLabel,
      value: deal.value,
      context: contextForPrompt || null,
      currentAnswers,
      currentScores,
      additionalContext: dto.additionalContext?.trim(),
    });

    const model = getMeddpiccModel(this.config);

    let reply: string;
    let modelId: string;
    try {
      const out = await this.anthropic.completeMessages({
        apiKey,
        model,
        system: MEDDPICC_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 4096,
      });
      reply = out.text;
      modelId = out.modelId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException(`Error llamando a Anthropic: ${msg}`);
    }

    let analysis: Record<string, unknown>;
    try {
      const cleaned = reply.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      throw new InternalServerErrorException('La IA no devolvió JSON válido');
    }

    const mergedAnswers: Record<string, string> = { ...currentAnswers };
    const analysisAnswers = analysis.answers as Record<string, unknown> | undefined;
    if (analysisAnswers && typeof analysisAnswers === 'object') {
      for (const [qid, ans] of Object.entries(analysisAnswers)) {
        const s = ans != null && typeof ans !== 'object' ? String(ans).trim() : '';
        const prev = String(mergedAnswers[qid] ?? '').trim();
        if (s && !prev) mergedAnswers[qid] = s;
      }
    }

    const mergedScoresRaw = analysis.scores;
    const mergedScores =
      mergedScoresRaw != null && typeof mergedScoresRaw === 'object' && !Array.isArray(mergedScoresRaw)
        ? { ...currentScores, ...asNumberRecord(mergedScoresRaw as Prisma.JsonValue) }
        : currentScores;

    const prevNotes = asNotesRecord(deal.notes);
    const nextNotes = {
      ...prevNotes,
      aiAssessment: analysis.overallAssessment ?? '',
      aiRisks: analysis.risks,
      aiStrengths: analysis.strengths,
      aiNextQuestions: analysis.nextQuestions,
      scoreJustifications: analysis.scoreJustifications,
      lastAnalysis: new Date().toISOString(),
      lastAnalysisModelId: modelId,
    };

    for (const dim of Object.keys(mergedScores)) {
      if (mergedScores[dim] !== currentScores[dim]) {
        await this.prisma.meddpiccHistory.create({
          data: {
            dealId: id,
            dimension: dim,
            score: mergedScores[dim] ?? null,
            note: 'AI analysis',
          },
        });
      }
    }

    const updated = await this.prisma.meddpiccDeal.update({
      where: { id },
      data: {
        answers: mergedAnswers as unknown as Prisma.InputJsonValue,
        scores: mergedScores as unknown as Prisma.InputJsonValue,
        notes: nextNotes as unknown as Prisma.InputJsonValue,
      },
      include: {
        user: { select: { id: true, email: true, name: true, lastName: true } },
        attachments: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return {
      deal: this.serializeDeal(updated as DealWithUser),
      analysis,
    };
  }
}
