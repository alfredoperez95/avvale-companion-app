import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicCredentialsService } from '../ai-credentials/anthropic/anthropic-credentials.service';
import { UserPayload } from '../auth/decorators/user-payload';
import { PrismaService } from '../prisma/prisma.service';
import { AnthropicClientService } from '../yubiq/approve-seal-filler/anthropic-client.service';
import { KycService } from './kyc.service';

const admin: UserPayload = { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };
const creator: UserPayload = { userId: 'user-1', email: 'creator@example.com', role: 'USER' };
const otherUser: UserPayload = { userId: 'user-2', email: 'other@example.com', role: 'USER' };

function buildTx() {
  return {
    kycFact: { deleteMany: vi.fn() },
    kycOpenQuestion: { deleteMany: vi.fn() },
    kycChatSession: { deleteMany: vi.fn() },
    kycOrgRelationship: { deleteMany: vi.fn() },
    kycOrgMember: { deleteMany: vi.fn() },
    kycSignal: { deleteMany: vi.fn() },
    kycProfile: { deleteMany: vi.fn() },
    kycCompany: { findUnique: vi.fn(), delete: vi.fn(), updateMany: vi.fn() },
    kycAuditLog: { create: vi.fn() },
  };
}

describe('KycService destructive authorization', () => {
  let service: KycService;
  let tx: ReturnType<typeof buildTx>;
  const prisma = {
    $transaction: vi.fn(),
    kycCompany: { findUnique: vi.fn(), delete: vi.fn(), updateMany: vi.fn() },
    kycAuditLog: { create: vi.fn() },
    kycProfile: { deleteMany: vi.fn() },
    kycFact: { deleteMany: vi.fn() },
    kycOpenQuestion: { findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    kycChatSession: { deleteMany: vi.fn() },
    kycOrgRelationship: { findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    kycOrgMember: { findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    kycSignal: { deleteMany: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tx = buildTx();
    prisma.$transaction.mockImplementation(async (fn: (txArg: typeof tx) => unknown) => fn(tx));
    tx.kycCompany.findUnique.mockImplementation(async ({ where }: { where: { id: bigint } }) => ({
      id: where.id,
      name: `Company ${where.id.toString()}`,
      createdByUserId: creator.userId,
    }));
    service = new KycService(
      prisma as unknown as PrismaService,
      { get: vi.fn() } as unknown as ConfigService,
      {} as AnthropicCredentialsService,
      {} as AnthropicClientService,
    );
  });

  it('permite a un admin borrar empresas legacy y empresas con creador en bulk-delete', async () => {
    prisma.kycCompany.findUnique
      .mockResolvedValueOnce({ id: 1n, createdByUserId: null })
      .mockResolvedValueOnce({ id: 2n, createdByUserId: creator.userId });

    const result = await service.bulkDeleteCompanyProfiles([1, 2], admin);

    expect(result).toEqual({ deleted: 2 });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.kycAuditLog.create).toHaveBeenCalledTimes(2);
    expect(tx.kycCompany.delete).toHaveBeenCalledTimes(2);
  });

  it('permite al creador borrar su empresa', async () => {
    prisma.kycCompany.findUnique.mockResolvedValue({ id: 1n, createdByUserId: creator.userId });

    await expect(service.deleteKycDataForCompany(1n, creator)).resolves.toEqual({ ok: true });
    expect(tx.kycAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'company.delete',
          actorUserId: creator.userId,
          entity: 'kycCompany',
          entityId: '1',
          meta: expect.objectContaining({ deletedCompanyId: '1', bulk: false }),
        }),
      }),
    );
    expect(tx.kycCompany.delete).toHaveBeenCalledWith({ where: { id: 1n } });
  });

  it('rechaza a un usuario que no creó la empresa', async () => {
    prisma.kycCompany.findUnique.mockResolvedValue({ id: 1n, createdByUserId: creator.userId });

    await expect(service.deleteKycDataForCompany(1n, otherUser)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza a usuarios no admin al borrar empresas legacy sin createdByUserId', async () => {
    prisma.kycCompany.findUnique.mockResolvedValue({ id: 1n, createdByUserId: null });

    await expect(service.deleteKycDataForCompany(1n, creator)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('hace fallar bulk-delete completo si contiene una empresa no autorizada', async () => {
    prisma.kycCompany.findUnique
      .mockResolvedValueOnce({ id: 1n, createdByUserId: creator.userId })
      .mockResolvedValueOnce({ id: 2n, createdByUserId: otherUser.userId });

    await expect(service.bulkDeleteCompanyProfiles([1, 2], creator)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('valida permisos de empresa antes de borrar un miembro de organigrama', async () => {
    prisma.kycOrgMember.findUnique.mockResolvedValue({ companyId: 1n });
    prisma.kycCompany.findUnique.mockResolvedValue({ id: 1n, createdByUserId: creator.userId });

    await expect(service.deleteMember(10n, creator)).resolves.toEqual({ ok: true });
    expect(prisma.kycOrgMember.delete).toHaveBeenCalledWith({ where: { id: 10n } });
  });

  it('valida permisos de empresa antes de borrar una relación de organigrama', async () => {
    prisma.kycOrgRelationship.findUnique.mockResolvedValue({ companyId: 1n });
    prisma.kycCompany.findUnique.mockResolvedValue({ id: 1n, createdByUserId: creator.userId });

    await expect(service.deleteRel(20n, creator)).resolves.toEqual({ ok: true });
    expect(prisma.kycOrgRelationship.delete).toHaveBeenCalledWith({ where: { id: 20n } });
  });

  it('valida permisos de empresa antes de borrar una pregunta abierta', async () => {
    prisma.kycOpenQuestion.findUnique.mockResolvedValue({ companyId: 1n });
    prisma.kycCompany.findUnique.mockResolvedValue({ id: 1n, createdByUserId: creator.userId });

    await expect(service.deleteOpenQuestion(30n, creator)).resolves.toEqual({ ok: true });
    expect(prisma.kycOpenQuestion.delete).toHaveBeenCalledWith({ where: { id: 30n } });
  });
});
