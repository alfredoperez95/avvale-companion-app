import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RfqAnalysisStatus, RfqWorkspaceSource } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { RfqStorageService } from './rfq-storage.service';
import { RfqAnalysisProducer } from '../queue/producers/rfq-analysis-producer.service';
import { AnthropicClientService } from '../yubiq/approve-seal-filler/anthropic-client.service';
import { AnthropicCredentialsService } from '../ai-credentials/anthropic/anthropic-credentials.service';
import { RfqAnalysisService } from './rfq-analysis.service';

describe('RfqAnalysisService.create', () => {
  let service: RfqAnalysisService;
  const prisma = {
    kycCompany: { findFirst: vi.fn() },
    rfqAnalysis: { create: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RfqAnalysisService(
      prisma as unknown as PrismaService,
      { get: vi.fn() } as unknown as ConfigService,
      {} as RfqStorageService,
      {} as RfqAnalysisProducer,
      {} as AnthropicClientService,
      {} as AnthropicCredentialsService,
    );
  });

  it('rechaza empresa KYC inexistente', async () => {
    prisma.kycCompany.findFirst.mockResolvedValue(null);

    await expect(
      service.create('user-1', { title: 'RFQ', kycCompanyId: 123 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rfqAnalysis.create).not.toHaveBeenCalled();
  });

  it('rechaza empresa KYC sin perfil activo', async () => {
    prisma.kycCompany.findFirst.mockResolvedValue(null);

    await expect(
      service.create('user-1', { title: 'RFQ', kycCompanyId: 123 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.kycCompany.findFirst).toHaveBeenCalledWith({
      where: { id: 123n, profile: { isNot: null } },
      select: { id: true },
    });
  });

  it('permite empresa KYC compartida con perfil activo y crea RFQ para el usuario autenticado', async () => {
    prisma.kycCompany.findFirst.mockResolvedValue({ id: 123n });
    prisma.rfqAnalysis.create.mockResolvedValue({ id: 'analysis-1' });

    const result = await service.create('user-1', {
      title: '  RFQ cliente  ',
      manualContext: '  contexto  ',
      kycCompanyId: 123,
    });

    expect(result).toEqual({ id: 'analysis-1' });
    expect(prisma.kycCompany.findFirst).toHaveBeenCalledWith({
      where: { id: 123n, profile: { isNot: null } },
      select: { id: true },
    });
    expect(prisma.rfqAnalysis.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        sourceType: RfqWorkspaceSource.MANUAL,
        status: RfqAnalysisStatus.DRAFT,
        title: 'RFQ cliente',
        manualContext: 'contexto',
        kycCompanyId: 123n,
      },
      select: { id: true },
    });
  });
});
