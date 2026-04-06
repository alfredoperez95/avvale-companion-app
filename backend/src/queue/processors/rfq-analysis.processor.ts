import { Injectable, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { RfqAnalysisStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RfqPipelineService } from '../../rfq-analysis/rfq-pipeline.service';
import { RFQ_ANALYSIS_JOB_NAME, RFQ_ANALYSIS_QUEUE } from '../queue.constants';
import type { RfqAnalysisJobPayload } from '../types/rfq-analysis-job.payload';

@Processor(RFQ_ANALYSIS_QUEUE)
@Injectable()
export class RfqAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(RfqAnalysisProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: RfqPipelineService,
  ) {
    super();
  }

  async process(
    job: Job<RfqAnalysisJobPayload, unknown, typeof RFQ_ANALYSIS_JOB_NAME>,
  ): Promise<void> {
    const { analysisId, userId } = job.data;
    this.logger.log(`Procesando RFQ analysis=${analysisId} job=${job.id}`);

    const row = await this.prisma.rfqAnalysis.findUnique({
      where: { id: analysisId },
      select: { id: true, userId: true, status: true },
    });
    if (!row) {
      throw new UnrecoverableError(`Análisis ${analysisId} no existe`);
    }
    if (row.userId !== userId) {
      throw new UnrecoverableError('userId no coincide con el análisis');
    }

    await this.prisma.rfqAnalysis.update({
      where: { id: analysisId },
      data: {
        status: RfqAnalysisStatus.PROCESSING,
        failureReason: null,
      },
    });

    try {
      await this.pipeline.runPipeline(analysisId, userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Fallo pipeline RFQ analysis=${analysisId}: ${msg}`);
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<RfqAnalysisJobPayload, unknown, typeof RFQ_ANALYSIS_JOB_NAME> | undefined,
    err: Error,
  ): Promise<void> {
    if (!job) return;
    const { analysisId } = job.data;
    const maxAttempts = job.opts.attempts ?? 1;
    const attemptsMade = job.attemptsMade;
    const msg = err?.message ?? String(err);

    if (err instanceof UnrecoverableError || err?.name === 'UnrecoverableError') {
      this.logger.error(`RFQ ${analysisId} no recuperable: ${msg}`);
      return;
    }

    if (attemptsMade >= maxAttempts) {
      await this.prisma.rfqAnalysis.update({
        where: { id: analysisId },
        data: {
          status: RfqAnalysisStatus.FAILED,
          failureReason: msg.slice(0, 8000),
        },
      });
      this.logger.error(`RFQ ${analysisId} FAILED tras ${attemptsMade} intentos`);
    }
  }
}
