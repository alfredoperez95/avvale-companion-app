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
    rfqAnalysis: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    rfqAnalysisSource: { count: vi.fn() },
  };
  const producer = {
    enqueueRfqAnalysis: vi.fn(),
  };
  const creds = {
    getApiKeyPlainOrThrow: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RfqAnalysisService(
      prisma as unknown as PrismaService,
      { get: vi.fn() } as unknown as ConfigService,
      {} as RfqStorageService,
      producer as unknown as RfqAnalysisProducer,
      {} as AnthropicClientService,
      creds as unknown as AnthropicCredentialsService,
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

  it('no expone storagePath en las fuentes devueltas por findOne', async () => {
    const now = new Date('2026-07-21T10:30:00.000Z');
    prisma.rfqAnalysis.findFirst.mockResolvedValue({
      id: 'analysis-1',
      userId: 'user-1',
      title: 'RFQ',
      status: RfqAnalysisStatus.DRAFT,
      sourceType: RfqWorkspaceSource.MANUAL,
      manualContext: null,
      originEmail: null,
      originSubject: null,
      failureReason: null,
      kycCompanyId: 123n,
      kycCompany: { id: 123n, name: 'Cliente' },
      createdAt: now,
      updatedAt: now,
      sources: [
        {
          id: 'source-1',
          analysisId: 'analysis-1',
          kind: 'FILE',
          sortOrder: 0,
          fileName: 'rfq.pdf',
          mimeType: 'application/pdf',
          storagePath: 'rfq-analyses/analysis-1/rfq.pdf',
          extractedText: null,
          extractionStatus: 'PENDING',
          extractionError: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      insights: [],
      messages: [],
      jobEvents: [],
    });

    const result = await service.findOne('user-1', 'analysis-1');

    expect(result.sources[0]).toEqual(
      expect.not.objectContaining({
        storagePath: expect.anything(),
      }),
    );
    expect(result.sources[0]).toEqual(expect.objectContaining({ fileName: 'rfq.pdf' }));
  });

  it('marca procesamiento en cola con where id + userId', async () => {
    prisma.rfqAnalysis.findFirst.mockResolvedValue({
      id: 'analysis-1',
      userId: 'user-1',
      status: RfqAnalysisStatus.DRAFT,
      manualContext: 'Contexto',
    });
    prisma.rfqAnalysisSource.count.mockResolvedValue(0);
    creds.getApiKeyPlainOrThrow.mockResolvedValue('sk-ant-test');
    producer.enqueueRfqAnalysis.mockResolvedValue('job-1');
    prisma.rfqAnalysis.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.requestProcess('user-1', 'analysis-1')).resolves.toEqual({ jobId: 'job-1' });

    expect(prisma.rfqAnalysis.updateMany).toHaveBeenCalledWith({
      where: { id: 'analysis-1', userId: 'user-1' },
      data: {
        status: RfqAnalysisStatus.QUEUED,
        failureReason: null,
        bullJobId: 'job-1',
      },
    });
  });
});
