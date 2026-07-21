import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const now = new Date('2026-07-21T11:30:00.000Z');
  const prisma = {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.auditLog.create.mockResolvedValue({ id: 1n });
    service = new AuditService(prisma as unknown as PrismaService);
  });

  it('registra eventos globales minimizados y redacta campos sensibles', async () => {
    await service.record({
      actorUserId: 'user-1',
      actorEmail: 'user@example.com',
      actorRole: 'ADMIN',
      actorType: 'admin',
      module: 'auth',
      action: 'login',
      entity: 'auth.login',
      method: 'POST',
      path: '/auth/login',
      statusCode: 201,
      requestId: 'req-12345678',
      before: { password: 'secret' },
      after: { ok: true },
      meta: { token: 'raw-token', visible: 'ok' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'user-1',
        actorEmail: 'user@example.com',
        actorRole: 'ADMIN',
        actorType: 'admin',
        module: 'auth',
        action: 'login',
        before: { password: '[REDACTED]' },
        meta: { token: '[REDACTED]', visible: 'ok' },
      }),
    });
  });

  it('lista eventos con filtros y serializa ids para la API admin', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 10n,
        actorUserId: 'user-1',
        actorEmail: 'user@example.com',
        actorRole: 'USER',
        actorType: 'user',
        actor: { id: 'user-1', email: 'user@example.com', name: 'User', lastName: 'One' },
        module: 'kyc',
        action: 'read',
        entity: 'kyc.companies',
        entityId: '25',
        method: 'GET',
        path: '/kyc/companies/25',
        route: null,
        statusCode: 200,
        requestId: 'req-12345678',
        ip: '127.0.0.1',
        userAgent: 'vitest',
        tokenHash: null,
        before: null,
        after: null,
        meta: { durationMs: 12 },
        createdAt: now,
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    const out = await service.list({
      page: '2',
      pageSize: '25',
      module: 'kyc',
      action: 'read',
      actorUserId: 'user-1',
      entity: 'kyc.companies',
      entityId: '25',
      requestId: 'req-12345678',
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          actorUserId: 'user-1',
          module: 'kyc',
          action: 'read',
          entity: 'kyc.companies',
          entityId: '25',
          requestId: 'req-12345678',
        },
        skip: 25,
        take: 25,
      }),
    );
    expect(out).toEqual({
      items: [
        expect.objectContaining({
          id: '10',
          actorUserId: 'user-1',
          module: 'kyc',
          action: 'read',
          requestId: 'req-12345678',
          createdAt: now.toISOString(),
        }),
      ],
      total: 1,
      page: 2,
      pageSize: 25,
    });
  });
});
