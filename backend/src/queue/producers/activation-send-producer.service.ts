import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ACTIVATION_SEND_JOB_NAME, ACTIVATION_SEND_QUEUE } from '../queue.constants';
import type { SendActivationJobPayload } from '../types/send-activation-job.payload';

@Injectable()
export class ActivationSendProducer {
  private readonly logger = new Logger(ActivationSendProducer.name);

  constructor(
    @InjectQueue(ACTIVATION_SEND_QUEUE)
    private readonly queue: Queue<SendActivationJobPayload>,
  ) {}

  /**
   * Encola el envío. jobId estable evita duplicados mientras el trabajo siga en cola o activo.
   * Si existía un job fallido/completado con el mismo id, se elimina antes de re-encolar.
   */
  async enqueueSendActivation(payload: SendActivationJobPayload): Promise<string> {
    const jobId = `send-activation-${payload.activationId}`;
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'waiting' || state === 'active' || state === 'delayed') {
        this.logger.log(
          `Job ${jobId} ya existe en estado ${state}; no se duplica el encolado`,
        );
        return existing.id ?? jobId;
      }
      if (state === 'completed' || state === 'failed') {
        await existing.remove();
      }
    }

    const job = await this.queue.add(ACTIVATION_SEND_JOB_NAME, payload, { jobId });
    const id = job.id ?? jobId;
    this.logger.log(`Encolado envío Make para activación ${payload.activationId}, jobId=${id}`);
    return id;
  }
}
