import {
  BadRequestException,
  Controller,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { verifyElevenlabsWebhookPayload } from './elevenlabs-webhook-signature';
import { MeddpiccService } from './meddpicc.service';

/**
 * Webhook público ElevenLabs (post_call_transcription → MEDDPICC).
 * URL: `POST /webhooks/elevenlabs/meddpicc` con cabecera `elevenlabs-signature`.
 */
@Controller('webhooks/elevenlabs')
export class MeddpiccConvaiWebhookController {
  private readonly logger = new Logger(MeddpiccConvaiWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly meddpicc: MeddpiccService,
  ) {}

  @Post('meddpicc')
  async postCallMeddpicc(@Req() req: Request): Promise<{ ok: true; duplicate?: boolean }> {
    const secret = this.config.get<string>('ELEVENLABS_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      this.logger.warn('ConvAI webhook recibido pero ELEVENLABS_WEBHOOK_SECRET no está configurado');
      throw new ServiceUnavailableException('Webhook ElevenLabs no configurado en el servidor');
    }

    const rawBuf = req.rawBody;
    if (!rawBuf?.length) {
      this.logger.warn('ConvAI webhook sin rawBody (¿Content-Type application/json?)');
      throw new BadRequestException('Cuerpo bruto requerido para verificar la firma');
    }

    const rawUtf8 = rawBuf.toString('utf8');
    const sigHeader =
      req.headers['elevenlabs-signature'] ??
      req.headers['ElevenLabs-Signature'] ??
      req.headers['Elevenlabs-Signature'];
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

    const verified = verifyElevenlabsWebhookPayload(rawUtf8, sig, secret);
    if (!verified.ok) {
      throw new UnauthorizedException(verified.message);
    }

    const { duplicate } = await this.meddpicc.ingestConvaiPostCallEvent(verified.event);
    return { ok: true, ...(duplicate ? { duplicate: true } : {}) };
  }
}
