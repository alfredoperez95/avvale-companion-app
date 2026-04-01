import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivationStatus } from '@prisma/client';
import { UnrecoverableError } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MakeService } from '../make/make.service';
import { EmailSignatureService } from '../email-signature/email-signature.service';
import { buildMakeWebhookPayload, type ActivationForMakePayload } from '../make/make-webhook-payload';
import { ActivationLookupService } from './activation-lookup.service';
import { normalizeEmailHtmlSpacing } from './email-html.util';
import { resolveBackendPublicBaseUrl } from '../config/backend-public-base-url';

@Injectable()
export class ActivationSendOrchestrator {
  private readonly logger = new Logger(ActivationSendOrchestrator.name);

  constructor(
    private readonly activationLookup: ActivationLookupService,
    private readonly prisma: PrismaService,
    private readonly makeService: MakeService,
    private readonly emailSignatureService: EmailSignatureService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Llama al webhook de Make y deja la activación en PENDING_CALLBACK si OK.
   * Errores de red / respuesta Make → lanza para que BullMQ reintente.
   * Estados obviamente incorrectos → UnrecoverableError (sin reintentos).
   */
  async deliverActivationToMake(activationId: string, userId: string): Promise<void> {
    const activation = await this.activationLookup.findOneByIdAndUser(activationId, userId);

    if (
      activation.status === ActivationStatus.PENDING_CALLBACK ||
      activation.status === ActivationStatus.SENT
    ) {
      this.logger.log(
        `Activación ${activationId} ya está ${activation.status}; idempotente, sin segunda llamada a Make`,
      );
      return;
    }

    if (
      activation.status !== ActivationStatus.QUEUED &&
      activation.status !== ActivationStatus.PROCESSING &&
      activation.status !== ActivationStatus.RETRYING
    ) {
      throw new UnrecoverableError(
        `Estado no admite envío asíncrono: ${activation.status}`,
      );
    }

    const signatureHtml = await this.emailSignatureService.getContent(userId);
    const emailSignature = signatureHtml.trim() ? signatureHtml : null;
    const attachmentsBaseUrl = await resolveBackendPublicBaseUrl(this.config);

    const payload = buildMakeWebhookPayload(activation as ActivationForMakePayload, {
      emailSignature,
      attachmentsBaseUrl,
    });

    const normalizedPayload = {
      ...payload,
      body: normalizeEmailHtmlSpacing(payload.body, { preserveTrailingBreaks: true }),
      emailSignature: normalizeEmailHtmlSpacing(payload.emailSignature),
    };

    // Si no hay adjuntos, omitir el campo para que Make pueda rutear sin Iterator.
    // (Make suele tratar distinto [] vs campo ausente.)
    if (normalizedPayload.attachments.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (normalizedPayload as any).attachments;
    }

    const result = await this.makeService.triggerWebhook(normalizedPayload);

    if (result.success) {
      // No pisar SENT: si Make responde 200 y el callback "sent" llega antes que este update,
      // el estado ya puede ser SENT (docs/ACTIVATION_STATE_MACHINE — condición de carrera).
      const updated = await this.prisma.activation.updateMany({
        where: {
          id: activationId,
          status: {
            in: [
              ActivationStatus.QUEUED,
              ActivationStatus.PROCESSING,
              ActivationStatus.RETRYING,
            ],
          },
        },
        data: {
          status: ActivationStatus.PENDING_CALLBACK,
          makeRunId: result.makeRunId ?? null,
          errorMessage: null,
          lastStatusAt: new Date(),
        },
      });

      if (updated.count === 0) {
        const row = await this.prisma.activation.findUnique({
          where: { id: activationId },
          select: { status: true },
        });
        if (row?.status === ActivationStatus.SENT) {
          this.logger.log(
            `Activación ${activationId} ya estaba SENT (callback ganó la carrera); no se sobrescribe con PENDING_CALLBACK`,
          );
        } else {
          this.logger.warn(
            `Activación ${activationId}: webhook OK pero no se pudo pasar a PENDING_CALLBACK (estado=${row?.status})`,
          );
        }
      } else {
        this.logger.log(`Make aceptó el webhook para activación ${activationId}`);
      }

      return;
    }

    const errMsg = result.errorMessage ?? 'Error desconocido al contactar con Make';
    this.logger.warn(`Make rechazó o falló el webhook para activación ${activationId}: ${errMsg}`);
    throw new Error(errMsg);
  }

}
