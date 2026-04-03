import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserPayload } from '../../auth/decorators/user-payload';
import { PdfExtractionService } from './pdf-extraction.service';
import { cleanOfferTitleFromFilename } from './offer-title.util';
import { AnthropicCredentialsService } from '../../ai-credentials/anthropic/anthropic-credentials.service';
import { AnthropicClientService, type AnthropicModelChoice } from './anthropic-client.service';
import { buildOfferExtractionPrompt } from './prompts/offer-extraction-prompt';
import type { ClaudeOfferExtractionInternal } from './offer-extraction.types';
import { normalizeClaudeExtraction } from './offer-extraction-normalizer';

type AnalyzeOfferResponse = {
  success: boolean;
  fileName: string;
  cleanTitleFromFilename: string;
  extractedTextLength: number;
  /** Prompt completo enviado a Claude (incluye texto extraído del PDF). */
  promptPreview: string;
  result: unknown;
  rawClaudeJson: string;
  modelUsed: string;
  log: string[];
};

@Controller('yubiq/approve-seal-filler')
@UseGuards(JwtAuthGuard)
export class ApproveSealFillerController {
  constructor(
    private readonly pdf: PdfExtractionService,
    private readonly creds: AnthropicCredentialsService,
    private readonly anthropic: AnthropicClientService,
  ) {}

  @Post('analyze')
  @UseInterceptors(FileInterceptor('file'))
  async analyze(
    @CurrentUser() user: UserPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('model') modelRaw?: string,
  ): Promise<AnalyzeOfferResponse> {
    const log: string[] = [];
    try {
      if (!file?.buffer) throw new BadRequestException('Falta el archivo');
      if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException('El archivo debe ser un PDF');
      }
      const maxBytes = 20 * 1024 * 1024;
      if (file.size != null && file.size > maxBytes) {
        throw new BadRequestException('El PDF supera el tamaño máximo (20MB)');
      }
      log.push('PDF received');

      const fileName = file.originalname ?? 'document.pdf';
      const cleanTitleFromFilename = cleanOfferTitleFromFilename(fileName);
      const extractedText = await this.pdf.extractTextFromPdfBuffer(file.buffer);
      log.push('Text extracted');

      const model: AnthropicModelChoice =
        modelRaw === 'sonnet' || modelRaw === 'opus' || modelRaw === 'haiku' ? modelRaw : 'haiku';

      const prompt = buildOfferExtractionPrompt({
        fileName,
        cleanTitleFromFilename,
        extractedText,
      });
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

      return {
        success: true,
        fileName,
        cleanTitleFromFilename,
        extractedTextLength: extractedText.length,
        promptPreview: prompt,
        result: normalized,
        rawClaudeJson: recoveredJson,
        modelUsed: modelId,
        log,
      };
    } catch (e) {
      throw e;
    }
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

