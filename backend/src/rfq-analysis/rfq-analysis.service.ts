import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  RfqAnalysisStatus,
  RfqExtractionStatus,
  RfqSourceKind,
  RfqWorkspaceSource,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RfqStorageService } from './rfq-storage.service';
import { resolveRfqInboundAttachmentMime } from './rfq-inbound-attachment-mime';
import {
  areInboundEmailTextsEquivalent,
  buildEmailInboundContextPreview,
  sanitizeInboundEmailText,
} from './rfq-email-inbound-text';
import { RfqAnalysisProducer } from '../queue/producers/rfq-analysis-producer.service';
import { CreateRfqAnalysisDto } from './dto/create-rfq-analysis.dto';
import { PostRfqMessageDto } from './dto/post-rfq-message.dto';
import type { RfqEmailInboundDto } from './dto/rfq-email-inbound.dto';
import {
  getRfqChatModel,
  getRfqContextMaxChars,
  getRfqMaxAttachments,
  getRfqMaxFileBytes,
  getRfqMaxTotalBytes,
} from './rfq-analysis.config';
import { AnthropicClientService } from '../yubiq/approve-seal-filler/anthropic-client.service';
import { AnthropicCredentialsService } from '../ai-credentials/anthropic/anthropic-credentials.service';
import { buildRfqChatSystemPrompt } from './prompts/rfq-chat-system-prompt';
import { formatBytesHuman, truncateForContext } from './rfq-analysis.utils';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

@Injectable()
export class RfqAnalysisService {
  private readonly logger = new Logger(RfqAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: RfqStorageService,
    @Inject(forwardRef(() => RfqAnalysisProducer))
    private readonly producer: RfqAnalysisProducer,
    private readonly anthropic: AnthropicClientService,
    private readonly creds: AnthropicCredentialsService,
  ) {}

  async remove(userId: string, analysisId: string): Promise<{ ok: true }> {
    const result = await this.prisma.rfqAnalysis.deleteMany({
      where: { id: analysisId, userId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Análisis no encontrado');
    }
    try {
      await this.storage.deleteRfqAnalysisFolder(analysisId);
    } catch (err) {
      this.logger.warn(
        `No se pudo borrar carpeta de adjuntos RFQ ${analysisId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return { ok: true };
  }

  async create(userId: string, dto: CreateRfqAnalysisDto) {
    return this.prisma.rfqAnalysis.create({
      data: {
        userId,
        sourceType: RfqWorkspaceSource.MANUAL,
        status: RfqAnalysisStatus.DRAFT,
        title: dto.title.trim(),
        manualContext: dto.manualContext?.trim() || null,
      },
    });
  }

  async list(userId: string, query: { page?: string; pageSize?: string }) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(query.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
    );
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.rfqAnalysis.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          status: true,
          sourceType: true,
          createdAt: true,
          updatedAt: true,
          originSubject: true,
          originEmail: true,
        },
      }),
      this.prisma.rfqAnalysis.count({ where: { userId } }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Actualiza la lista de preguntas recomendadas del insight más reciente (p. ej. tras quitar filas en la UI).
   */
  async updateRecommendedQuestions(userId: string, analysisId: string, questions: string[]) {
    await this.ensureOwned(analysisId, userId);
    const insight = await this.prisma.rfqAnalysisInsight.findFirst({
      where: { analysisId },
      orderBy: { version: 'desc' },
    });
    if (!insight) {
      throw new NotFoundException('No hay análisis estructurado para actualizar');
    }
    const cleaned = questions.map((q) => q.trim()).filter((q) => q.length > 0);
    await this.prisma.rfqAnalysisInsight.update({
      where: { id: insight.id },
      data: {
        recommendedQuestions: cleaned as Prisma.InputJsonValue,
      },
    });
    return { ok: true };
  }

  async findOne(userId: string, id: string) {
    const row = await this.prisma.rfqAnalysis.findFirst({
      where: { id, userId },
      include: {
        sources: { orderBy: { sortOrder: 'asc' } },
        insights: { orderBy: { version: 'desc' }, take: 1 },
        messages: { orderBy: { createdAt: 'asc' }, take: 200 },
        jobEvents: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
    if (!row) throw new NotFoundException('Análisis no encontrado');
    return row;
  }

  async uploadSources(
    userId: string,
    analysisId: string,
    files: Express.Multer.File[],
  ): Promise<{ added: number }> {
    const analysis = await this.ensureOwned(analysisId, userId);
    if (
      analysis.status === RfqAnalysisStatus.PROCESSING ||
      analysis.status === RfqAnalysisStatus.QUEUED
    ) {
      throw new BadRequestException('No se pueden añadir archivos mientras se procesa');
    }

    const maxFiles = getRfqMaxAttachments(this.config);
    const maxFile = getRfqMaxFileBytes(this.config);
    const maxTotal = getRfqMaxTotalBytes(this.config);

    const existingCount = await this.prisma.rfqAnalysisSource.count({
      where: { analysisId, kind: RfqSourceKind.FILE },
    });
    if (existingCount + files.length > maxFiles) {
      throw new BadRequestException(`Máximo ${maxFiles} adjuntos por análisis`);
    }

    let runningTotal = await this.computeStoredBytes(analysisId);
    let sortBase =
      (await this.prisma.rfqAnalysisSource.findFirst({
        where: { analysisId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      }))?.sortOrder ?? -1;

    for (const file of files) {
      if (!file?.buffer?.length) continue;
      if (file.size > maxFile) {
        throw new BadRequestException(`El archivo supera el tamaño máximo (${Math.floor(maxFile / (1024 * 1024))} MB)`);
      }
      runningTotal += file.buffer.length;
      if (runningTotal > maxTotal) {
        throw new BadRequestException('Se supera el tamaño total permitido para este análisis');
      }
      sortBase += 1;
      const saved = await this.storage.saveUploadedFile(analysisId, {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      });
      await this.prisma.rfqAnalysisSource.create({
        data: {
          analysisId,
          kind: RfqSourceKind.FILE,
          sortOrder: sortBase,
          fileName: saved.fileName,
          mimeType: saved.mimeType,
          storagePath: saved.storedPath,
        },
      });
    }

    return { added: files.filter((f) => f?.buffer?.length).length };
  }

  private async computeStoredBytes(analysisId: string): Promise<number> {
    const paths = await this.prisma.rfqAnalysisSource.findMany({
      where: { analysisId, storagePath: { not: null } },
      select: { storagePath: true },
    });
    let total = 0;
    for (const p of paths) {
      if (!p.storagePath) continue;
      try {
        const buf = await this.storage.readFile(p.storagePath);
        total += buf.length;
      } catch {
        // ignore missing
      }
    }
    return total;
  }

  async requestProcess(userId: string, analysisId: string): Promise<{ jobId: string }> {
    const analysis = await this.ensureOwned(analysisId, userId);
    if (analysis.status === RfqAnalysisStatus.QUEUED || analysis.status === RfqAnalysisStatus.PROCESSING) {
      throw new BadRequestException('El análisis ya está en cola o procesándose');
    }

    const hasContext = (analysis.manualContext?.trim()?.length ?? 0) > 0;
    const sourceCount = await this.prisma.rfqAnalysisSource.count({ where: { analysisId } });
    if (!hasContext && sourceCount === 0) {
      throw new BadRequestException('Añade al menos un archivo o contexto manual antes de analizar');
    }

    await this.creds.getApiKeyPlainOrThrow(userId).catch(() => {
      throw new BadRequestException(
        'Configura tu clave de Anthropic en la app (misma que Yubiq) antes de procesar',
      );
    });

    const jobId = await this.producer.enqueueRfqAnalysis({ analysisId, userId });

    await this.prisma.rfqAnalysis.update({
      where: { id: analysisId },
      data: {
        status: RfqAnalysisStatus.QUEUED,
        failureReason: null,
        bullJobId: jobId,
      },
    });

    return { jobId };
  }

  async postMessage(userId: string, analysisId: string, dto: PostRfqMessageDto) {
    const analysis = await this.ensureOwned(analysisId, userId);
    if (analysis.status !== RfqAnalysisStatus.COMPLETED) {
      throw new BadRequestException('El chat solo está disponible cuando el análisis está completado');
    }

    const insight = await this.prisma.rfqAnalysisInsight.findFirst({
      where: { analysisId },
      orderBy: { version: 'desc' },
    });
    if (!insight) {
      throw new BadRequestException('No hay resultado estructurado para contextualizar el chat');
    }

    const sources = await this.prisma.rfqAnalysisSource.findMany({
      where: { analysisId },
      orderBy: { sortOrder: 'asc' },
    });
    const digestParts = sources.map((s) => {
      const head = s.fileName ?? s.kind;
      const txt = (s.extractedText ?? '').trim();
      return `[${head}]\n${txt}`;
    });
    const sourcesDigest = truncateForContext(digestParts.join('\n\n---\n\n'), getRfqContextMaxChars(this.config));

    const insightJson = JSON.stringify({
      executiveSummary: insight.executiveSummary,
      opportunityType: insight.opportunityType,
      detectedTechnologies: insight.detectedTechnologies,
      avvaleAreas: insight.avvaleAreas,
      functionalVision: insight.functionalVision,
      technicalVision: insight.technicalVision,
      risksAndUnknowns: insight.risksAndUnknowns,
      recommendedQuestions: insight.recommendedQuestions,
      confidenceNotes: insight.confidenceNotes,
    });

    const system = buildRfqChatSystemPrompt({
      title: analysis.title,
      insightJson,
      sourcesDigest,
    });

    const history = await this.prisma.rfqAnalysisMessage.findMany({
      where: { analysisId },
      orderBy: { createdAt: 'asc' },
      take: 40,
    });

    const messages: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const m of history) {
      if (m.role === 'USER') messages.push({ role: 'user', content: m.content });
      else if (m.role === 'ASSISTANT') messages.push({ role: 'assistant', content: m.content });
    }
    messages.push({ role: 'user', content: dto.content.trim() });

    const apiKey = await this.creds.getApiKeyPlainOrThrow(userId);
    const model = getRfqChatModel(this.config);

    await this.prisma.rfqAnalysisMessage.create({
      data: {
        analysisId,
        role: 'USER',
        content: dto.content.trim(),
      },
    });

    const { text, modelId } = await this.anthropic.completeMessages({
      apiKey,
      model,
      system,
      messages,
      maxTokens: 4096,
    });

    await this.prisma.rfqAnalysisMessage.create({
      data: {
        analysisId,
        role: 'ASSISTANT',
        content: text.trim(),
        modelId,
      },
    });

    return { assistantMessage: text.trim(), modelId };
  }

  /**
   * Webhook Make: valida secreto y remitente registrado antes de trabajo costoso.
   */
  async handleInboundEmail(dto: RfqEmailInboundDto): Promise<{ ok: boolean; reason?: string; analysisId?: string }> {
    const expected = this.config.get<string>('RFQ_EMAIL_WEBHOOK_SECRET')?.trim();
    if (!expected) {
      this.logger.warn('RFQ_EMAIL_WEBHOOK_SECRET no configurada');
      throw new ServiceUnavailableException('Webhook no disponible');
    }
    if (dto.secret !== expected) {
      throw new UnauthorizedException('Secreto inválido');
    }

    const email = dto.fromEmail.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.logger.warn(`RFQ email rechazado: remitente no registrado ${email}`);
      return { ok: false, reason: 'unknown_sender' };
    }

    const maxAtt = getRfqMaxAttachments(this.config);
    const maxFile = getRfqMaxFileBytes(this.config);
    const maxTotal = getRfqMaxTotalBytes(this.config);
    const attachments = dto.attachments ?? [];

    if (attachments.length > maxAtt) {
      this.logger.warn(`RFQ email rechazado: demasiados adjuntos (${attachments.length})`);
      return { ok: false, reason: 'too_many_attachments' };
    }

    let estimatedTotal = 0;
    for (const a of attachments) {
      const b64len = a.contentBase64?.length ?? 0;
      const approx = Math.floor((b64len * 3) / 4);
      if (approx > maxFile) {
        this.logger.warn(
          `RFQ email rechazado: adjunto supera límite por fichero (aprox ${formatBytesHuman(approx)} > máx ${formatBytesHuman(maxFile)}, fileName=${a.fileName?.slice(0, 120) ?? '?'})`,
        );
        return { ok: false, reason: 'attachment_too_large' };
      }
      estimatedTotal += approx;
    }
    if (estimatedTotal > maxTotal) {
      this.logger.warn(
        `RFQ email rechazado: tamaño total de adjuntos aprox ${formatBytesHuman(estimatedTotal)} > máx ${formatBytesHuman(maxTotal)}`,
      );
      return { ok: false, reason: 'total_size_exceeded' };
    }

    try {
      await this.creds.getApiKeyPlainOrThrow(user.id);
    } catch {
      this.logger.warn(`RFQ email rechazado: usuario sin clave Anthropic ${email}`);
      return { ok: false, reason: 'no_anthropic_key' };
    }

    const subjectSan = sanitizeInboundEmailText(dto.subject);
    const bodyPlainSan = sanitizeInboundEmailText(dto.bodyPlain);
    const threadRawSan = sanitizeInboundEmailText(dto.threadContext);

    if (bodyPlainSan) {
      this.logger.log(`RFQ email inbound: bodyPlain presente (${bodyPlainSan.length} caracteres)`);
    }
    if (threadRawSan) {
      this.logger.log(`RFQ email inbound: threadContext presente (${threadRawSan.length} caracteres)`);
    }

    let threadContextForSources = threadRawSan;
    if (threadRawSan && bodyPlainSan && areInboundEmailTextsEquivalent(bodyPlainSan, threadRawSan)) {
      this.logger.log('RFQ email inbound: threadContext descartado (equivalente a bodyPlain tras normalizar)');
      threadContextForSources = undefined;
    }

    const title = (subjectSan || 'Análisis desde email').slice(0, 512);

    /** Ensamblado prioridad asunto → cuerpo → hilo (sin duplicar fuentes en BD). Disponible para logs / extensiones futuras. */
    const emailContextPreview = buildEmailInboundContextPreview({
      subject: subjectSan,
      bodyPlain: bodyPlainSan,
      threadContext: threadContextForSources,
    });
    if (emailContextPreview.length > 0) {
      this.logger.log(
        `RFQ email inbound: vista previa de contexto ensamblado (${emailContextPreview.length} caracteres; pipeline usa fuentes EMAIL_BODY/THREAD + adjuntos)`,
      );
    }

    const analysis = await this.prisma.rfqAnalysis.create({
      data: {
        userId: user.id,
        sourceType: RfqWorkspaceSource.EMAIL,
        status: RfqAnalysisStatus.QUEUED,
        title,
        originEmail: email,
        originSubject: subjectSan?.slice(0, 998) ?? null,
        originThreadContext: threadContextForSources?.slice(0, 8000) ?? null,
        manualContext: null,
      },
    });

    let order = 0;
    if (bodyPlainSan) {
      await this.prisma.rfqAnalysisSource.create({
        data: {
          analysisId: analysis.id,
          kind: RfqSourceKind.EMAIL_BODY,
          sortOrder: order++,
          extractedText: bodyPlainSan,
          extractionStatus: RfqExtractionStatus.OK,
        },
      });
    }
    if (threadContextForSources) {
      await this.prisma.rfqAnalysisSource.create({
        data: {
          analysisId: analysis.id,
          kind: RfqSourceKind.THREAD_CONTEXT,
          sortOrder: order++,
          extractedText: threadContextForSources,
          extractionStatus: RfqExtractionStatus.OK,
        },
      });
    }

    for (const att of attachments) {
      const buffer = Buffer.from(att.contentBase64, 'base64');
      if (buffer.length > maxFile) {
        this.logger.warn(
          `RFQ email: tras decodificar base64, adjunto ${formatBytesHuman(buffer.length)} > máx ${formatBytesHuman(maxFile)} (${att.fileName?.slice(0, 120) ?? '?'})`,
        );
        await this.failInboundAnalysis(analysis.id, 'attachment_too_large');
        return { ok: false, reason: 'attachment_too_large' };
      }
      const resolvedMime = resolveRfqInboundAttachmentMime({
        contentType: att.contentType,
        mimeType: att.mimeType,
        fileName: att.fileName,
      });
      const saved = await this.storage.saveUploadedFile(analysis.id, {
        buffer,
        originalname: att.fileName,
        mimetype: resolvedMime,
      });
      await this.prisma.rfqAnalysisSource.create({
        data: {
          analysisId: analysis.id,
          kind: RfqSourceKind.FILE,
          sortOrder: order++,
          fileName: saved.fileName,
          mimeType: saved.mimeType,
          storagePath: saved.storedPath,
        },
      });
    }

    if (order === 0) {
      await this.prisma.rfqAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: RfqAnalysisStatus.FAILED,
          failureReason: 'Email sin cuerpo ni adjuntos procesables',
        },
      });
      return { ok: false, reason: 'no_content', analysisId: analysis.id };
    }

    const jobId = await this.producer.enqueueRfqAnalysis({ analysisId: analysis.id, userId: user.id });
    await this.prisma.rfqAnalysis.update({
      where: { id: analysis.id },
      data: { bullJobId: jobId },
    });

    return { ok: true, analysisId: analysis.id };
  }

  private async failInboundAnalysis(analysisId: string, reason: string): Promise<void> {
    await this.prisma.rfqAnalysis.update({
      where: { id: analysisId },
      data: {
        status: RfqAnalysisStatus.FAILED,
        failureReason: reason,
      },
    });
  }

  private async ensureOwned(id: string, userId: string) {
    const a = await this.prisma.rfqAnalysis.findFirst({ where: { id, userId } });
    if (!a) throw new NotFoundException('Análisis no encontrado');
    return a;
  }
}
