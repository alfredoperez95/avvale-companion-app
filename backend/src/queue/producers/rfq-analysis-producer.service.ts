import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RFQ_ANALYSIS_JOB_NAME, RFQ_ANALYSIS_QUEUE } from '../queue.constants';
import type { RfqAnalysisJobPayload } from '../types/rfq-analysis-job.payload';

@Injectable()
export class RfqAnalysisProducer {
  private readonly logger = new Logger(RfqAnalysisProducer.name);

  constructor(
    @InjectQueue(RFQ_ANALYSIS_QUEUE)
    private readonly queue: Queue<RfqAnalysisJobPayload>,
  ) {}

  /**
   * Encola el pipeline. jobId estable evita duplicados mientras el trabajo siga en cola o activo.
   */
  async enqueueRfqAnalysis(payload: RfqAnalysisJobPayload): Promise<string> {
    const jobId = `rfq-analysis-${payload.analysisId}`;
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'waiting' || state === 'active' || state === 'delayed') {
        this.logger.log(`Job ${jobId} ya existe en estado ${state}; no se duplica`);
        return existing.id ?? jobId;
      }
      if (state === 'completed' || state === 'failed') {
        await existing.remove();
      }
    }

    const job = await this.queue.add(RFQ_ANALYSIS_JOB_NAME, payload, { jobId });
    const id = job.id ?? jobId;
    this.logger.log(`Encolado RFQ analysis=${payload.analysisId} jobId=${id}`);
    return id;
  }
}
