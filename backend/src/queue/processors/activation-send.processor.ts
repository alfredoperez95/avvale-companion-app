import { Injectable, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { ActivationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivationSendOrchestrator } from '../../activations/activation-send.orchestrator';
import { ACTIVATION_SEND_JOB_NAME, ACTIVATION_SEND_QUEUE } from '../queue.constants';
import type { SendActivationJobPayload } from '../types/send-activation-job.payload';

@Processor(ACTIVATION_SEND_QUEUE)
@Injectable()
export class ActivationSendProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivationSendProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: ActivationSendOrchestrator,
  ) {
    super();
  }

  async process(job: Job<SendActivationJobPayload, unknown, typeof ACTIVATION_SEND_JOB_NAME>): Promise<void> {
    const { activationId, userId } = job.data;
    this.logger.log(
      `Procesando envío Make activación=${activationId} job=${job.id} intento=${job.attemptsMade}/${job.opts.attempts}`,
    );

    const activation = await this.prisma.activation.findUnique({
      where: { id: activationId },
      select: { processingStartedAt: true, status: true },
    });

    if (!activation) {
      throw new UnrecoverableError(`Activación ${activationId} no existe`);
    }

    const updateProcessing: Prisma.ActivationUpdateInput = {
      status: ActivationStatus.PROCESSING,
      lastStatusAt: new Date(),
      sendAttemptCount: { increment: 1 },
    };
    if (!activation.processingStartedAt) {
      updateProcessing.processingStartedAt = new Date();
    }

    await this.prisma.activation.update({
      where: { id: activationId },
      data: updateProcessing,
    });

    try {
      await this.orchestrator.deliverActivationToMake(activationId, userId);
      this.logger.log(`Envío Make completado para activación ${activationId} (job ${job.id})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Fallo procesando envío activación=${activationId} job=${job.id}: ${msg}`,
      );
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<SendActivationJobPayload, unknown, typeof ACTIVATION_SEND_JOB_NAME> | undefined,
    err: Error,
  ): Promise<void> {
    if (!job) return;
    const { activationId } = job.data;
    const maxAttempts = job.opts.attempts ?? 1;
    const attemptsMade = job.attemptsMade;
    const rawMessage = err?.message ?? String(err);

    // Para MariaDB: error_message probablemente es VARCHAR(n) y P2000 ocurre si superamos n.
    // Priorizamos el límite real de la columna (information_schema) y aplicamos truncado.
    let msg = rawMessage;
    let columnType: string | null = null;
    let columnMax: number | null = null;
    let effectiveMax = 190;

    try {
      const columnInfo = await this.prisma.$queryRawUnsafe<
        Array<{
          COLUMN_TYPE?: string | null;
          CHARACTER_MAXIMUM_LENGTH?: string | number | null;
        }>
      >(
        "SELECT COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='activations' AND COLUMN_NAME='error_message'",
      );

      columnType = columnInfo?.[0]?.COLUMN_TYPE ?? null;
      const columnMaxRaw = columnInfo?.[0]?.CHARACTER_MAXIMUM_LENGTH ?? null;
      const columnMaxNum =
        typeof columnMaxRaw === 'string' ? parseInt(columnMaxRaw, 10) : columnMaxRaw;
      columnMax = Number.isFinite(columnMaxNum) ? (columnMaxNum as number) : null;
      effectiveMax = columnMax != null ? Math.max(0, columnMax - 1) : effectiveMax;
      msg = rawMessage.slice(0, effectiveMax);
    } catch {
      msg = rawMessage.slice(0, effectiveMax);
    }

    if (err instanceof UnrecoverableError || err?.name === 'UnrecoverableError') {
      await this.prisma.activation.update({
        where: { id: activationId },
        data: {
          status: ActivationStatus.FAILED,
          errorMessage: msg || 'Error no recuperable en el envío',
          lastStatusAt: new Date(),
        },
      });
      this.logger.error(`Activación ${activationId} FAILED (no recuperable): ${msg}`);
      return;
    }

    if (attemptsMade >= maxAttempts) {
      await this.prisma.activation.update({
        where: { id: activationId },
        data: {
          status: ActivationStatus.FAILED,
          errorMessage: msg || 'Error al enviar a Make tras reintentos',
          lastStatusAt: new Date(),
        },
      });
      this.logger.error(
        `Activación ${activationId} marcada FAILED tras ${attemptsMade} intentos (job ${job.id})`,
      );
      return;
    }

    await this.prisma.activation.update({
      where: { id: activationId },
      data: {
        status: ActivationStatus.RETRYING,
        errorMessage: msg,
        lastStatusAt: new Date(),
      },
    });
    this.logger.log(
      `Activación ${activationId} en RETRYING (intento ${attemptsMade}/${maxAttempts}, job ${job.id})`,
    );
  }
}
