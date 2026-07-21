import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicCredentialsService } from '../ai-credentials/anthropic/anthropic-credentials.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnthropicClientService } from '../yubiq/approve-seal-filler/anthropic-client.service';
import { KycService } from './kyc.service';

describe('KycService audit trail', () => {
  let service: KycService;
  const now = new Date('2026-07-21T09:30:00.000Z');
  const prisma = {
    $queryRaw: vi.fn(),
    kycCompany: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    kycProfile: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    kycAuditLog: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.kycCompany.updateMany.mockResolvedValue({ count: 1 });
    prisma.kycAuditLog.create.mockResolvedValue({ id: 1n });
    prisma.auditLog.create.mockResolvedValue({ id: 100n });
    service = new KycService(
      prisma as unknown as PrismaService,
      { get: vi.fn() } as unknown as ConfigService,
      {} as AnthropicCredentialsService,
      {} as AnthropicClientService,
    );
    vi.spyOn(service, 'fetchNewsSignals').mockResolvedValue({ ok: true, created: 0, total: 0, url: '' });
  });

  it('registra auditoría al crear una empresa KYC', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.kycCompany.create.mockResolvedValue({
      id: 10n,
      name: 'Acme',
      sector: null,
      industry: null,
      city: null,
      country: 'Spain',
      website: null,
      revenue: null,
      employees: null,
      techStack: null,
      source: 'kyc',
      notes: null,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      createdAt: now,
      updatedAt: now,
    });
    prisma.kycProfile.upsert.mockResolvedValue({ companyId: 10n });

    await service.createCompany({ name: 'Acme' }, 'user-1');

    expect(prisma.kycCompany.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1',
        }),
      }),
    );
    expect(prisma.kycAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 10n,
          actorUserId: 'user-1',
          action: 'company.create',
          entity: 'kycCompany',
          entityId: '10',
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: 'user-1',
          actorType: 'user',
          module: 'kyc',
          action: 'company.create',
          entity: 'kycCompany',
          entityId: '10',
          path: '/kyc/kycCompany',
          meta: expect.objectContaining({ kycAction: 'company.create', kycCompanyId: '10' }),
        }),
      }),
    );
  });

  it('registra auditoría y updatedByUserId al editar una empresa KYC', async () => {
    prisma.kycCompany.findUnique.mockResolvedValue({
      id: 10n,
      name: 'Acme',
      sector: null,
      industry: null,
      city: null,
      country: 'Spain',
      website: null,
      revenue: null,
      employees: null,
      techStack: null,
      source: 'kyc',
      notes: null,
      createdByUserId: 'user-1',
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now,
    });
    prisma.kycCompany.update.mockResolvedValue({
      id: 10n,
      name: 'Acme España',
      sector: null,
      industry: null,
      city: null,
      country: 'Spain',
      website: null,
      revenue: null,
      employees: null,
      techStack: null,
      source: 'kyc',
      notes: null,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-2',
      createdAt: now,
      updatedAt: now,
    });

    await service.patchCompany(10n, { name: 'Acme España' }, 'user-2');

    expect(prisma.kycCompany.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10n },
        data: expect.objectContaining({ name: 'Acme España', updatedByUserId: 'user-2' }),
      }),
    );
    expect(prisma.kycAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 10n,
          actorUserId: 'user-2',
          action: 'company.update',
          entity: 'kycCompany',
          entityId: '10',
          meta: expect.objectContaining({ fields: expect.arrayContaining(['name', 'updatedByUserId']) }),
        }),
      }),
    );
  });

  it('asigna creador y actualizador al importar una empresa KYC nueva', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.kycCompany.create.mockResolvedValue({
      id: 10n,
      name: 'Imported Co',
      sector: null,
      industry: null,
      city: null,
      country: 'Spain',
      website: null,
      revenue: null,
      employees: null,
      techStack: null,
      source: 'kyc-import',
      notes: null,
      createdByUserId: 'admin-1',
      updatedByUserId: 'admin-1',
      createdAt: now,
      updatedAt: now,
    });
    prisma.kycProfile.findUnique.mockResolvedValue(null);
    prisma.kycProfile.create.mockResolvedValue({ companyId: 10n });

    await service.importCompanies([{ name: 'Imported Co' }], 'admin-1');

    expect(prisma.kycCompany.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'kyc-import',
          createdByUserId: 'admin-1',
          updatedByUserId: 'admin-1',
        }),
      }),
    );
  });

});
