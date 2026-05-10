import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicCredentialsService } from '../ai-credentials/anthropic/anthropic-credentials.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnthropicClientService } from '../yubiq/approve-seal-filler/anthropic-client.service';
import type { KycLinkedInProfileDto } from './dto/kyc-linkedin-profile.dto';
import { KycService } from './kyc.service';

function orgMemberCreateResult() {
  return {
    id: 10n,
    companyId: 1n,
    name: 'Jane Doe',
    role: 'Engineering Manager',
    area: null,
    level: 4,
    reportsToId: null,
    linkedin: 'https://www.linkedin.com/in/janedoe',
    notes: null,
    contactId: 99n,
    source: 'linkedin',
    createdAt: new Date(),
  };
}

describe('KycService.ingestLinkedInOrgProfile', () => {
  let service: KycService;
  const prisma = {
    kycCompany: { findUnique: vi.fn() },
    kycOrgMember: { findMany: vi.fn(), create: vi.fn() },
    kycContact: { create: vi.fn() },
  };

  const dto: KycLinkedInProfileDto = {
    source: 'linkedin',
    clientId: 1,
    name: 'Jane Doe',
    role: 'Engineering Manager',
    level: 'Manager',
    linkedInUrl: 'https://www.linkedin.com/in/janedoe',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new KycService(
      prisma as unknown as PrismaService,
      { get: vi.fn() } as unknown as ConfigService,
      {} as AnthropicCredentialsService,
      {} as AnthropicClientService,
    );
  });

  it('404 si la empresa no existe', async () => {
    prisma.kycCompany.findUnique.mockResolvedValue(null);
    await expect(service.ingestLinkedInOrgProfile(dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('400 si no hay perfil KYC activo', async () => {
    prisma.kycCompany.findUnique.mockResolvedValue({ id: 1n, profile: null });
    await expect(service.ingestLinkedInOrgProfile(dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('409 si ya existe miembro con la misma URL normalizada', async () => {
    prisma.kycCompany.findUnique.mockResolvedValue({ id: 1n, profile: { companyId: 1n } });
    prisma.kycOrgMember.findMany.mockResolvedValue([
      { linkedin: 'https://www.linkedin.com/in/janedoe' },
    ]);
    await expect(service.ingestLinkedInOrgProfile(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('400 exclusión por área competencia', async () => {
    prisma.kycCompany.findUnique.mockResolvedValue({ id: 1n, profile: { companyId: 1n } });
    prisma.kycOrgMember.findMany.mockResolvedValue([]);
    await expect(
      service.ingestLinkedInOrgProfile({
        ...dto,
        company: 'competencia',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('201 crea contacto y miembro', async () => {
    prisma.kycCompany.findUnique.mockResolvedValue({ id: 1n, profile: { companyId: 1n } });
    prisma.kycOrgMember.findMany.mockResolvedValue([]);
    prisma.kycContact.create.mockResolvedValue({ id: 99n });
    prisma.kycOrgMember.create.mockResolvedValue(orgMemberCreateResult());

    const out = await service.ingestLinkedInOrgProfile(dto);
    expect(out).toEqual({ orgMemberId: 10, contactId: 99 });
    expect(prisma.kycContact.create).toHaveBeenCalled();
    expect(prisma.kycOrgMember.create).toHaveBeenCalled();
  });
});
