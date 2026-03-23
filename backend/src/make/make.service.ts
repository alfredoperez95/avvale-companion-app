import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { ActivationStatus } from '@prisma/client';
import { MakeWebhookPayloadV1 } from './make-webhook-payload';
import { MakeCallbackDto } from './dto/make-callback.dto';
import { formatActivationCode } from '../activations/activation-code';

const WEBHOOK_TIMEOUT_MS = 30_000;

export interface MakeWebhookResult {
  success: boolean;
  makeRunId?: string | null;
  errorMessage?: string;
}

@Injectable()
export class MakeService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  /**
   * POST JSON al webhook de Make. No lanza: devuelve resultado para que la capa de dominio actualice estado.
   */
  async triggerWebhook(payload: MakeWebhookPayloadV1): Promise<MakeWebhookResult> {
    const url = this.config.get<string>('MAKE_WEBHOOK_URL')?.trim();
    if (!url) {
      return {
        success: false,
        errorMessage: 'MAKE_WEBHOOK_URL no está configurada',
      };
    }

    const secret = this.config.get<string>('MAKE_WEBHOOK_SECRET')?.trim();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (secret) {
      headers['X-Webhook-Secret'] = secret;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const text = await res.text();
      const makeRunId = this.extractMakeRunIdFromBody(text);

      if (!res.ok) {
        const snippet = text.length > 500 ? `${text.slice(0, 500)}…` : text;
        return {
          success: false,
          errorMessage: `Make respondió ${res.status}: ${snippet || res.statusText}`,
        };
      }

      return {
        success: true,
        makeRunId: makeRunId ?? null,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof Error && e.name === 'AbortError') {
        return { success: false, errorMessage: `Timeout al llamar a Make (${WEBHOOK_TIMEOUT_MS} ms)` };
      }
      return { success: false, errorMessage: `Error de red al llamar a Make: ${msg}` };
    } finally {
      clearTimeout(timer);
    }
  }

  private extractMakeRunIdFromBody(text: string): string | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      const j = JSON.parse(trimmed) as Record<string, unknown>;
      const candidates = ['makeRunId', 'executionId', 'imtId', 'id'] as const;
      for (const key of candidates) {
        const v = j[key];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Llamado por Make al finalizar el envío (módulo HTTP en el escenario).
   */
  async handleActivationCallback(dto: MakeCallbackDto): Promise<void> {
    const expected = this.config.get<string>('MAKE_CALLBACK_SECRET')?.trim();
    if (!expected) {
      throw new ServiceUnavailableException('MAKE_CALLBACK_SECRET no está configurada');
    }
    if (dto.secret !== expected) {
      throw new UnauthorizedException('Secreto de callback inválido');
    }

    const activation = await this.prisma.activation.findFirst({ where: { id: dto.activationId } });
    if (!activation) {
      throw new NotFoundException('Activación no encontrada');
    }

    if (
      dto.activationNumber !== undefined &&
      dto.activationNumber !== activation.activationNumber
    ) {
      throw new BadRequestException('activationNumber no coincide con la activación indicada');
    }

    const codeTrimmed = dto.activationCode?.trim();
    if (codeTrimmed) {
      const expected = formatActivationCode(activation.activationNumber);
      if (codeTrimmed !== expected) {
        throw new BadRequestException('activationCode no coincide con la activación indicada');
      }
    }

    if (dto.status === 'sent') {
      await this.prisma.activation.update({
        where: { id: dto.activationId },
        data: {
          status: ActivationStatus.SENT,
          makeSentAt: new Date(),
          errorMessage: null,
          lastStatusAt: new Date(),
        },
      });
      await this.attachmentsService.schedulePublicExpiryForActivation(dto.activationId, 30);
      return;
    }

    await this.prisma.activation.update({
      where: { id: dto.activationId },
      data: {
        status: ActivationStatus.ERROR,
        errorMessage: dto.errorMessage?.trim() || 'Error reportado por Make',
        lastStatusAt: new Date(),
      },
    });
  }
}
