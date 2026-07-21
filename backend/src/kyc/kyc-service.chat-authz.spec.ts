import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicCredentialsService } from '../ai-credentials/anthropic/anthropic-credentials.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnthropicClientService } from '../yubiq/approve-seal-filler/anthropic-client.service';
import { KycService } from './kyc.service';

describe('KycService chat authorization', () => {
  let service: KycService;
  const creds = {
    getApiKeyPlainOrThrow: vi.fn(),
  };
  const prisma = {
    kycChatSession: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    kycChatMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new KycService(
      prisma as unknown as PrismaService,
      { get: vi.fn() } as unknown as ConfigService,
      creds as unknown as AnthropicCredentialsService,
      {} as AnthropicClientService,
    );
  });

  it('lista mensajes solo si la sesión pertenece al usuario autenticado', async () => {
    const now = new Date('2026-07-21T10:00:00.000Z');
    prisma.kycChatSession.findFirst.mockResolvedValue({
      id: 10n,
      companyId: 20n,
      userId: 'user-1',
      title: 'Investigación KYC',
      workdir: null,
      sessionType: 'research',
      createdAt: now,
      updatedAt: now,
    });
    prisma.kycChatMessage.findMany.mockResolvedValue([
      { id: 1n, sessionId: 10n, role: 'user', content: 'Hola', meta: null, createdAt: now },
    ]);

    await expect(service.getChatMessages(10n, 'user-1')).resolves.toEqual([
      expect.objectContaining({ id: 1, role: 'user', content: 'Hola' }),
    ]);
    expect(prisma.kycChatSession.findFirst).toHaveBeenCalledWith({ where: { id: 10n, userId: 'user-1' } });
    expect(prisma.kycChatMessage.findMany).toHaveBeenCalledWith({ where: { sessionId: 10n }, orderBy: { id: 'asc' } });
  });

  it('rechaza lectura de mensajes cuando el sessionId no pertenece al usuario', async () => {
    prisma.kycChatSession.findFirst.mockResolvedValue(null);

    await expect(service.getChatMessages(10n, 'user-2')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.kycChatMessage.findMany).not.toHaveBeenCalled();
  });

  it('rechaza stream de una sesión ajena antes de crear mensajes o llamar a Anthropic', async () => {
    prisma.kycChatSession.findFirst.mockResolvedValue(null);
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    };

    await service.streamChat(10n, 'user-2', res as never, 'Hola');

    expect(prisma.kycChatSession.findFirst).toHaveBeenCalledWith({ where: { id: 10n, userId: 'user-2' } });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Session not found' });
    expect(creds.getApiKeyPlainOrThrow).not.toHaveBeenCalled();
    expect(prisma.kycChatMessage.create).not.toHaveBeenCalled();
  });
});
