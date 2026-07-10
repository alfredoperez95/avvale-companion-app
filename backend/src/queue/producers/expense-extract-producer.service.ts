import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EXPENSE_EXTRACT_JOB_NAME, EXPENSE_EXTRACT_QUEUE } from '../queue.constants';
import type { ExpenseExtractJobPayload } from '../types/expense-extract-job.payload';

@Injectable()
export class ExpenseExtractProducer {
  private readonly logger = new Logger(ExpenseExtractProducer.name);

  constructor(
    @InjectQueue(EXPENSE_EXTRACT_QUEUE)
    private readonly queue: Queue<ExpenseExtractJobPayload>,
  ) {}

  /**
   * Encola la extracción IA. jobId estable evita duplicados mientras el trabajo siga en cola o activo.
   */
  async enqueueExpenseExtract(payload: ExpenseExtractJobPayload): Promise<string> {
    const jobId = `expense-extract-${payload.expenseId}`;
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

    const job = await this.queue.add(EXPENSE_EXTRACT_JOB_NAME, payload, { jobId });
    const id = job.id ?? jobId;
    this.logger.log(`Encolado expense=${payload.expenseId} jobId=${id}`);
    return id;
  }
}
