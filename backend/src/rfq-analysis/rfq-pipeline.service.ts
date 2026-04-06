import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  Prisma,
  RfqAnalysisStatus,
  RfqExtractionStatus,
  RfqJobPhase,
  RfqSourceKind,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PdfExtractionService } from '../yubiq/approve-seal-filler/pdf-extraction.service';
import {
  AnthropicClientService,
  type AnthropicModelChoice,
} from '../yubiq/approve-seal-filler/anthropic-client.service';
import { AnthropicCredentialsService } from '../ai-credentials/anthropic/anthropic-credentials.service';
import { buildRfqSynthesisPrompt } from './prompts/rfq-synthesis-prompt';
import {
  getAppPublicUrl,
  getRfqContextMaxChars,
  getRfqSynthesisEscalationModel,
  getRfqSynthesisModel,
} from './rfq-analysis.config';
import { MailService } from '../mail/mail.service';
import { avvaleUnitNamesFromInsightJson } from '../mail/templates/rfq-analysis-completed.email';
import { buildRfqEmailSourceRows } from './rfq-completion-email.helpers';
import { recoverJsonObjectString, safeJsonParse, truncateForContext } from './rfq-analysis.utils';
import { RfqStorageService } from './rfq-storage.service';
import {
  extractTextFromSpreadsheetBuffer,
  isSpreadsheetOfficeMime,
  looksLikeSpreadsheetFileName,
} from './rfq-spreadsheet-text';

type InsightJson = {
  executiveSummary?: string;
  opportunityType?: string;
  detectedTechnologies?: unknown;
  avvaleAreas?: unknown;
  functionalVision?: string;
  technicalVision?: string;
  risksAndUnknowns?: string;
  recommendedQuestions?: unknown;
  confidenceNotes?: string;
};

@Injectable()
export class RfqPipelineService {
  private readonly logger = new Logger(RfqPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly pdf: PdfExtractionService,
    private readonly anthropic: AnthropicClientService,
    private readonly creds: AnthropicCredentialsService,
    private readonly storage: RfqStorageService,
    private readonly mail: MailService,
  ) {}

  async runPipeline(analysisId: string, userId: string): Promise<void> {
    const maxChars = getRfqContextMaxChars(this.config);

    await this.appendEvent(analysisId, RfqJobPhase.INGEST, 'started', {});
    await this.appendEvent(analysisId, RfqJobPhase.INGEST, 'completed', {});

    const analysis = await this.prisma.rfqAnalysis.findUnique({
      where: { id: analysisId },
      include: { sources: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!analysis || analysis.userId !== userId) {
      throw new Error('Análisis no encontrado o acceso denegado');
    }

    await this.appendEvent(analysisId, RfqJobPhase.EXTRACT, 'started', {});

    for (const src of analysis.sources) {
      if (src.kind === RfqSourceKind.FILE && src.storagePath) {
        await this.extractFileSource(src.id, src.storagePath, src.mimeType ?? '', src.fileName);
      } else if (
        src.kind === RfqSourceKind.EMAIL_BODY ||
        src.kind === RfqSourceKind.THREAD_CONTEXT ||
        src.kind === RfqSourceKind.MANUAL_NOTE
      ) {
        await this.prisma.rfqAnalysisSource.update({
          where: { id: src.id },
          data: {
            extractionStatus: RfqExtractionStatus.OK,
            extractedText: src.extractedText ?? '',
          },
        });
      }
    }

    await this.appendEvent(analysisId, RfqJobPhase.EXTRACT, 'completed', {});

    const fresh = await this.prisma.rfqAnalysis.findUnique({
      where: { id: analysisId },
      include: { sources: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!fresh) throw new Error('Análisis no encontrado tras extracción');

    await this.appendEvent(analysisId, RfqJobPhase.NORMALIZE, 'started', {});
    const bundle = this.buildNormalizedBundle(fresh.title, fresh.manualContext, fresh.sources);
    const normalized = truncateForContext(bundle, maxChars);
    await this.appendEvent(analysisId, RfqJobPhase.NORMALIZE, 'completed', {
      approxChars: normalized.length,
    });

    const primary = getRfqSynthesisModel(this.config);
    const escalation = getRfqSynthesisEscalationModel(this.config);

    await this.appendEvent(analysisId, RfqJobPhase.SYNTHESIZE, 'started', {
      primaryModel: primary,
      escalationModel: escalation,
    });

    const apiKey = await this.creds.getApiKeyPlainOrThrow(userId);
    const prompt = buildRfqSynthesisPrompt({ title: fresh.title, normalizedBundle: normalized });
    const promptHash = createHash('sha256').update(prompt).digest('hex');

    const pass1 = await this.runSynthesisPass(apiKey, primary, prompt);
    const nonPdfEscalation = this.sourcesNeedEscalationModel(fresh.sources);
    const parseFailed = !pass1.parsed;
    const shouldTryEscalation =
      (nonPdfEscalation || parseFailed) && escalation !== primary;

    let parsed: InsightJson | null = pass1.parsed;
    let recoveredJson = pass1.recoveredJson;
    let modelId = pass1.modelId;
    let escalationReason: 'none' | 'non_pdf' | 'parse_error' | 'non_pdf_and_parse_error' = 'none';

    if (shouldTryEscalation) {
      escalationReason =
        nonPdfEscalation && parseFailed
          ? 'non_pdf_and_parse_error'
          : nonPdfEscalation
            ? 'non_pdf'
            : 'parse_error';
      const pass2 = await this.runSynthesisPass(apiKey, escalation, prompt);
      if (pass2.parsed) {
        parsed = pass2.parsed;
        recoveredJson = pass2.recoveredJson;
        modelId = pass2.modelId;
      } else if (!parsed) {
        throw new Error('El modelo no devolvió JSON válido para el insight');
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('El modelo no devolvió JSON válido para el insight');
    }

    await this.appendEvent(analysisId, RfqJobPhase.SYNTHESIZE, 'completed', {
      promptHash,
      modelId,
      primaryModelId: pass1.modelId,
      ...(shouldTryEscalation ? { escalationModelId: escalation } : {}),
      escalationReason,
    });

    const prevMax = await this.prisma.rfqAnalysisInsight.aggregate({
      where: { analysisId },
      _max: { version: true },
    });
    const nextVersion = (prevMax._max.version ?? 0) + 1;

    const recommendedQuestions = Array.isArray(parsed.recommendedQuestions)
      ? parsed.recommendedQuestions
      : [];

    await this.prisma.rfqAnalysisInsight.create({
      data: {
        analysisId,
        version: nextVersion,
        executiveSummary: parsed.executiveSummary ?? null,
        opportunityType: parsed.opportunityType ?? null,
        detectedTechnologies: (parsed.detectedTechnologies ?? []) as Prisma.InputJsonValue,
        avvaleAreas: (parsed.avvaleAreas ?? []) as Prisma.InputJsonValue,
        functionalVision: parsed.functionalVision ?? null,
        technicalVision: parsed.technicalVision ?? null,
        risksAndUnknowns: parsed.risksAndUnknowns ?? null,
        recommendedQuestions: recommendedQuestions as Prisma.InputJsonValue,
        confidenceNotes: parsed.confidenceNotes ?? null,
        rawModelOutput: recoveredJson,
        synthesisModelId: modelId,
      },
    });

    await this.prisma.rfqAnalysis.update({
      where: { id: analysisId },
      data: {
        status: RfqAnalysisStatus.COMPLETED,
        lastProcessedAt: new Date(),
        failureReason: null,
      },
    });

    this.logger.log(`RFQ analysis ${analysisId} completado (insight v${nextVersion})`);

    const baseUrl = getAppPublicUrl(this.config);
    const viewUrl = `${baseUrl}/launcher/rfq-analysis/${analysisId}`;
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, enabled: true },
      });
      if (user?.email?.trim() && user.enabled !== false) {
        await this.mail.sendRfqAnalysisCompletedEmail(user.email.trim(), {
          analysisTitle: fresh.title,
          viewUrl,
          sourceRows: buildRfqEmailSourceRows(fresh.sources),
          avvaleUnitNames: avvaleUnitNamesFromInsightJson(parsed.avvaleAreas),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Correo de RFQ completado omitido (analysis=${analysisId}): ${msg}`);
    }
  }

  /** Archivo no PDF con extracción OK: conviene segunda pasada con modelo más capaz. */
  private sourcesNeedEscalationModel(
    sources: {
      kind: RfqSourceKind;
      mimeType: string | null;
      extractionStatus: RfqExtractionStatus;
    }[],
  ): boolean {
    return sources.some(
      (s) =>
        s.kind === RfqSourceKind.FILE &&
        s.extractionStatus === RfqExtractionStatus.OK &&
        (s.mimeType ?? '').toLowerCase().trim() !== 'application/pdf',
    );
  }

  private async runSynthesisPass(
    apiKey: string,
    model: AnthropicModelChoice,
    prompt: string,
  ): Promise<{ parsed: InsightJson | null; recoveredJson: string; modelId: string }> {
    const { text: claudeText, modelId } = await this.anthropic.extractJson({
      apiKey,
      model,
      prompt,
      maxTokens: 8192,
    });
    const recoveredJson = recoverJsonObjectString(claudeText);
    const raw = safeJsonParse(recoveredJson) as InsightJson | null;
    const parsed = raw && typeof raw === 'object' ? raw : null;
    return { parsed, recoveredJson, modelId };
  }

  private buildNormalizedBundle(
    title: string,
    manualContext: string | null,
    sources: { id: string; kind: RfqSourceKind; fileName: string | null; extractedText: string | null }[],
  ): string {
    const parts: string[] = [];
    parts.push(`## Metadatos\nTítulo: ${title}\n`);
    if (manualContext?.trim()) {
      parts.push(`## Contexto manual\n${manualContext.trim()}\n`);
    }
    for (const s of sources) {
      const label =
        s.kind === RfqSourceKind.FILE
          ? `Archivo: ${s.fileName ?? 'sin nombre'}`
          : s.kind === RfqSourceKind.EMAIL_BODY
            ? 'Cuerpo del email'
            : s.kind === RfqSourceKind.THREAD_CONTEXT
              ? 'Contexto del hilo de correo'
              : 'Nota manual';
      const text = (s.extractedText ?? '').trim();
      parts.push(`## Fuente [${s.id}] ${label}\n${text || '(vacío)'}\n`);
    }
    return parts.join('\n');
  }

  private async extractFileSource(
    sourceId: string,
    storagePath: string,
    mimeType: string,
    fileName: string | null,
  ): Promise<void> {
    const buf = await this.storage.readFile(storagePath);

    const mt = (mimeType || '').toLowerCase();
    try {
      let text = '';
      if (mt === 'application/pdf') {
        text = await this.pdf.extractTextFromPdfBuffer(buf);
      } else if (
        mt.startsWith('text/') ||
        mt === 'application/json' ||
        mt === 'application/xml'
      ) {
        text = buf.toString('utf8');
      } else if (isSpreadsheetOfficeMime(mt) || looksLikeSpreadsheetFileName(fileName)) {
        text = extractTextFromSpreadsheetBuffer(buf);
      } else if (
        mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mt === 'application/msword' ||
        mt.includes('presentation')
      ) {
        throw new Error(
          'Formato Office no soportado (Word/PowerPoint); exporta a PDF o texto. Excel (.xlsx / .xls) está soportado.',
        );
      } else {
        text = buf.toString('utf8');
        if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text.slice(0, 2000))) {
          throw new Error(`Tipo de archivo no soportado para extracción (${mimeType || 'desconocido'})`);
        }
      }
      await this.prisma.rfqAnalysisSource.update({
        where: { id: sourceId },
        data: {
          extractionStatus: RfqExtractionStatus.OK,
          extractedText: text.trim(),
          extractionError: null,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.prisma.rfqAnalysisSource.update({
        where: { id: sourceId },
        data: {
          extractionStatus: RfqExtractionStatus.FAILED,
          extractionError: msg,
        },
      });
      this.logger.warn(`Extracción fallida source=${sourceId}: ${msg}`);
    }
  }

  private async appendEvent(
    analysisId: string,
    phase: RfqJobPhase,
    status: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.rfqAnalysisJobEvent.create({
      data: {
        analysisId,
        phase,
        status,
        detail: Object.keys(detail).length ? (detail as Prisma.InputJsonValue) : undefined,
      },
    });
  }
}
