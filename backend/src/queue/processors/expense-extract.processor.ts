import { Injectable, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { ExpensesService } from '../../expenses/expenses.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EXPENSE_EXTRACT_JOB_NAME, EXPENSE_EXTRACT_QUEUE } from '../queue.constants';
import type { ExpenseExtractJobPayload } from '../types/expense-extract-job.payload';

@Processor(EXPENSE_EXTRACT_QUEUE)
@Injectable()
export class ExpenseExtractProcessor extends WorkerHost {
  private readonly logger = new Logger(ExpenseExtractProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expenses: ExpensesService,
  ) {
    super();
  }

  async process(
    job: Job<ExpenseExtractJobPayload, unknown, typeof EXPENSE_EXTRACT_JOB_NAME>,
  ): Promise<void> {
    const { expenseId, userId } = job.data;
    this.logger.log(`Procesando expense=${expenseId} job=${job.id}`);

    const row = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      select: { id: true, userId: true },
    });
    if (!row) {
      throw new UnrecoverableError(`Gasto ${expenseId} no existe`);
    }
    if (row.userId !== userId) {
      throw new UnrecoverableError('userId no coincide con el gasto');
    }

    await this.expenses.processQueuedExtraction(userId, expenseId);
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<ExpenseExtractJobPayload, unknown, typeof EXPENSE_EXTRACT_JOB_NAME> | undefined,
    err: Error,
  ): Promise<void> {
    if (!job) return;
    const { expenseId } = job.data;
    const maxAttempts = job.opts.attempts ?? 1;
    const attemptsMade = job.attemptsMade;
    const msg = err?.message ?? String(err);

    if (err instanceof UnrecoverableError || err?.name === 'UnrecoverableError') {
      this.logger.error(`Expense ${expenseId} no recuperable: ${msg}`);
      return;
    }

    if (attemptsMade >= maxAttempts) {
      await this.prisma.expense.update({
        where: { id: expenseId },
        data: {
          extractionError: msg.slice(0, 8000),
          rawModelOutput: null,
          modelId: null,
        },
      });
      this.logger.error(`Expense ${expenseId} FAILED tras ${attemptsMade} intentos`);
    }
  }
}
