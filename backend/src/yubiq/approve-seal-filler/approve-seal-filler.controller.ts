import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { createHash } from 'crypto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserPayload } from '../../auth/decorators/user-payload';
import { PdfExtractionService } from './pdf-extraction.service';
import { cleanOfferTitleFromFilename } from './offer-title.util';
import { AnthropicCredentialsService } from '../../ai-credentials/anthropic/anthropic-credentials.service';
import { AnthropicClientService, type AnthropicModelChoice } from './anthropic-client.service';
import { buildOfferExtractionPrompt } from './prompts/offer-extraction-prompt';
import { buildTranslateExtractionPrompt } from './prompts/translate-extraction-prompt';
import type { ClaudeOfferExtraction, ClaudeOfferExtractionInternal } from './offer-extraction.types';
import { normalizeClaudeExtraction } from './offer-extraction-normalizer';
import { mergeTranslatedExtraction } from './merge-translated-extraction';
import { TranslateExtractionDto } from './translate-extraction.dto';
import { AnalyzeOfferDto } from './analyze-offer.dto';
import { validateSafeFile } from '../../files/safe-file-validation';
import { PfeMarginExtractionService } from './pfe-margin-extraction.service';

const YUBIQ_APPROVE_SEAL_MAX_FILE_BYTES = 20 * 1024 * 1024;

type AnalyzeOfferResponse = {
  success: boolean;
  fileName: string;
  cleanTitleFromFilename: string;
  extractedTextLength: number;
  /** Huella del prompt enviado, sin exponer texto extraído del PDF. */
  promptHash: string;
  result: unknown;
  rawClaudeJson: string;
  modelUsed: string;
  log: string[];
};

type AnalyzeOfferFiles = {
  file?: Express.Multer.File[];
  pfe?: Express.Multer.File[];
};

@Controller('yubiq/approve-seal-filler')
@UseGuards(JwtAuthGuard)
export class ApproveSealFillerController {
  constructor(
    private readonly pdf: PdfExtractionService,
    private readonly creds: AnthropicCredentialsService,
    private readonly anthropic: AnthropicClientService,
    private readonly pfeMargin: PfeMarginExtractionService,
  ) {}

  @Post('analyze')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'file', maxCount: 1 }, { name: 'pfe', maxCount: 1 }], {
      limits: { fileSize: YUBIQ_APPROVE_SEAL_MAX_FILE_BYTES },
    }),
  )
  async analyze(
    @CurrentUser() user: UserPayload,
    @UploadedFiles() files: AnalyzeOfferFiles | undefined,
    @Body() body: AnalyzeOfferDto,
  ): Promise<AnalyzeOfferResponse> {
    const log: string[] = [];
    try {
      const file = files?.file?.[0];
      if (!file?.buffer) throw new BadRequestException('Falta el archivo');
      const safe = validateSafeFile('yubiq', {
        buffer: file.buffer,
        originalname: file.originalname || 'document.pdf',
        mimetype: file.mimetype,
        size: file.size,
      });
      log.push('PDF received');

      let margenPorcentaje: number | null = null;
      const pfeFile = files?.pfe?.[0];
      if (pfeFile?.buffer) {
        const safePfe = validateSafeFile('yubiqPfe', {
          buffer: pfeFile.buffer,
          originalname: pfeFile.originalname || 'pfe.xlsx',
          mimetype: pfeFile.mimetype,
          size: pfeFile.size,
        });
        log.push('PFE Excel received');
        try {
          margenPorcentaje = await this.pfeMargin.extractMarginPercentageFromBuffer(safePfe.buffer);
          log.push(margenPorcentaje == null ? 'PFE margin not found' : `PFE margin: ${margenPorcentaje}%`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log.push(`WARN: PFE margin extraction failed: ${message}`);
        }
      }

      const fileName = safe.displayName;
      const cleanTitleFromFilename = cleanOfferTitleFromFilename(fileName);
      const extractedText = await this.pdf.extractTextFromPdfBuffer(safe.buffer);
      log.push('Text extracted');

      const model: AnthropicModelChoice = body.model ?? 'haiku';

      const prompt = buildOfferExtractionPrompt({
        fileName,
        cleanTitleFromFilename,
        extractedText,
      });
      const promptHash = createHash('sha256').update(prompt).digest('hex');
      log.push('Prompt created');

      const apiKey = await this.creds.getApiKeyPlainOrThrow(user.userId);
      const { text: claudeText, modelId } = await this.anthropic.extractJson({
        apiKey,
        model,
        prompt,
      });
      log.push('Claude request sent');

      const recoveredJson = recoverJsonObjectString(claudeText);
      const parsed = safeJsonParse(recoveredJson) as ClaudeOfferExtractionInternal;
      if (!parsed || typeof parsed !== 'object') {
        throw new BadRequestException('Claude no devolvió JSON válido');
      }
      log.push('Claude response parsed');

      const { normalized, warnings } = normalizeClaudeExtraction(parsed);
      for (const w of warnings) log.push(`WARN: ${w}`);
      log.push('Result normalized');

      const result: ClaudeOfferExtraction = {
        ...normalized,
        margenPorcentaje,
      };

      return {
        success: true,
        fileName,
        cleanTitleFromFilename,
        extractedTextLength: extractedText.length,
        promptHash,
        result,
        rawClaudeJson: recoveredJson,
        modelUsed: modelId,
        log,
      };
    } catch (e) {
      throw e;
    }
  }

  @Post('translate')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async translate(
    @CurrentUser() user: UserPayload,
    @Body() body: TranslateExtractionDto,
  ): Promise<{ result: ClaudeOfferExtraction; rawClaudeJson: string; modelUsed: string }> {
    const raw = body.extraction;
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Falta extraction');
    }
    const original = raw as unknown as ClaudeOfferExtraction;
    if (typeof original.titulo !== 'string' || typeof original.nombreCliente !== 'string') {
      throw new BadRequestException('extraction inválida');
    }

    const model: AnthropicModelChoice =
      body.model === 'sonnet' || body.model === 'opus' || body.model === 'haiku' ? body.model : 'haiku';

    const serialized = JSON.stringify(original);
    const prompt = buildTranslateExtractionPrompt(serialized);
    const apiKey = await this.creds.getApiKeyPlainOrThrow(user.userId);

    const { text: claudeText, modelId } = await this.anthropic.extractJson({
      apiKey,
      model,
      prompt,
      maxTokens: 8192,
    });

    const recoveredJson = recoverJsonObjectString(claudeText);
    const parsedObj = safeJsonParse(recoveredJson) as Record<string, unknown> | null;
    if (!parsedObj || typeof parsedObj !== 'object') {
      throw new BadRequestException('Claude no devolvió JSON válido para la traducción');
    }

    const merged = mergeTranslatedExtraction(original, parsedObj);
    return {
      result: merged,
      rawClaudeJson: JSON.stringify(merged, null, 2),
      modelUsed: modelId,
    };
  }
}

function recoverJsonObjectString(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  try {
    JSON.parse(s);
    return s;
  } catch {
    // intentar rescatar el primer {...} completo
  }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return s.slice(first, last + 1);
  }
  return s;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

