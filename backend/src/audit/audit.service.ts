import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { redactSensitive } from '../security/sensitive-redaction';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

type AuditWriter = {
  auditLog?: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
  };
};

export type AuditActorType = 'user' | 'admin' | 'public' | 'system' | 'webhook' | 'worker' | 'extension';

export type AuditLogEntry = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  actorType: AuditActorType;
  module: string;
  action: string;
  entity?: string | null;
  entityId?: string | number | bigint | null;
  method?: string | null;
  path: string;
  route?: string | null;
  statusCode?: number | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  tokenHash?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  async record(entry: AuditLogEntry, prismaLike: unknown = this.prisma): Promise<void> {
    const writer = prismaLike as AuditWriter;
    if (!writer.auditLog?.create) return;
    try {
      await writer.auditLog.create({
        data: this.toCreateData(entry),
      });
    } catch (err) {
      this.logger.warn(`No se pudo registrar audit log: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async list(query: AuditLogQueryDto) {
    const writer = this.prisma as unknown as AuditWriter;
    const page = clampInt(query.page, 1, 10_000, 1);
    const pageSize = clampInt(query.pageSize, 1, 100, 50);
    const where: Record<string, unknown> = {};
    if (query.actorUserId?.trim()) where.actorUserId = query.actorUserId.trim();
    if (query.module?.trim()) where.module = query.module.trim();
    if (query.action?.trim()) where.action = query.action.trim();
    if (query.entity?.trim()) where.entity = query.entity.trim();
    if (query.entityId?.trim()) where.entityId = query.entityId.trim();
    if (query.requestId?.trim()) where.requestId = query.requestId.trim();

    const [items, total] = await Promise.all([
      writer.auditLog?.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: { select: { id: true, email: true, name: true, lastName: true } },
        },
      }) ?? [],
      writer.auditLog?.count({ where }) ?? 0,
    ]);

    return {
      items: items.map(serializeAuditLog),
      total,
      page,
      pageSize,
    };
  }

  private toCreateData(entry: AuditLogEntry): Record<string, unknown> {
    const actorUserId = entry.actorUserId?.trim() || null;
    return {
      actorUserId,
      actorEmail: entry.actorEmail?.trim() || null,
      actorRole: entry.actorRole?.trim() || null,
      actorType: entry.actorType,
      module: entry.module,
      action: entry.action,
      entity: entry.entity?.trim() || null,
      entityId: entry.entityId == null ? null : String(entry.entityId),
      method: entry.method?.trim() || null,
      path: entry.path,
      route: entry.route?.trim() || null,
      statusCode: entry.statusCode ?? null,
      requestId: entry.requestId?.trim() || null,
      ip: entry.ip?.trim() || null,
      userAgent: entry.userAgent?.trim().slice(0, 512) || null,
      tokenHash: entry.tokenHash?.trim() || null,
      before: toAuditJson(entry.before),
      after: toAuditJson(entry.after),
      meta: toAuditJson(entry.meta),
    };
  }
}

export function toAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return redactSensitive(value) as Prisma.InputJsonValue;
}

function clampInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function serializeAuditLog(log: unknown): Record<string, unknown> {
  const row = log as Record<string, unknown>;
  const actor = row.actor as Record<string, unknown> | null | undefined;
  return {
    id: String(row.id),
    actorUserId: row.actorUserId ?? null,
    actorEmail: row.actorEmail ?? null,
    actorRole: row.actorRole ?? null,
    actorType: row.actorType,
    actor: actor
      ? {
          id: String(actor.id),
          email: actor.email,
          name: actor.name ?? null,
          lastName: actor.lastName ?? null,
        }
      : null,
    module: row.module,
    action: row.action,
    entity: row.entity ?? null,
    entityId: row.entityId ?? null,
    method: row.method ?? null,
    path: row.path,
    route: row.route ?? null,
    statusCode: row.statusCode ?? null,
    requestId: row.requestId ?? null,
    ip: row.ip ?? null,
    userAgent: row.userAgent ?? null,
    tokenHash: row.tokenHash ?? null,
    before: row.before ?? null,
    after: row.after ?? null,
    meta: row.meta ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}
