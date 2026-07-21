import type { Logger } from '@nestjs/common';

type WorkerAuditPrisma = {
  auditLog?: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
};

type WorkerAuditEvent = {
  module: string;
  entity: string;
  entityId: string;
  actorUserId?: string | null;
  queue: string;
  jobName: string;
  jobId?: string | number | null;
  phase: 'started' | 'completed' | 'failed';
  attemptsMade?: number;
  attempts?: number;
  error?: string | null;
};

export async function recordWorkerAudit(
  prismaLike: unknown,
  logger: Logger,
  event: WorkerAuditEvent,
): Promise<void> {
  const writer = prismaLike as WorkerAuditPrisma;
  if (!writer.auditLog?.create) return;
  try {
    await writer.auditLog.create({
      data: {
        actorUserId: event.actorUserId?.trim() || null,
        actorType: 'worker',
        module: event.module,
        action: 'worker',
        entity: event.entity,
        entityId: event.entityId,
        method: null,
        path: `worker://${event.queue}/${event.jobName}`,
        route: null,
        statusCode: null,
        requestId: null,
        before: undefined,
        after: undefined,
        meta: {
          queue: event.queue,
          jobName: event.jobName,
          jobId: event.jobId == null ? null : String(event.jobId),
          phase: event.phase,
          attemptsMade: event.attemptsMade ?? null,
          attempts: event.attempts ?? null,
          error: event.error ? event.error.slice(0, 512) : null,
        },
      },
    });
  } catch (err) {
    logger.warn(`No se pudo registrar auditoría worker: ${err instanceof Error ? err.message : String(err)}`);
  }
}
