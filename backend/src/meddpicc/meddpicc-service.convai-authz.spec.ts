import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicCredentialsService } from '../ai-credentials/anthropic/anthropic-credentials.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnthropicClientService } from '../yubiq/approve-seal-filler/anthropic-client.service';
import { MeddpiccExtractService } from './meddpicc-extract.service';
import { MeddpiccStorageService } from './meddpicc-storage.service';
import { MeddpiccService } from './meddpicc.service';

const DEAL_ID = '11111111-1111-4111-8111-111111111111';

describe('MeddpiccService ConvAI webhook authorization', () => {
  let service: MeddpiccService;
  const prisma = {
    meddpiccDeal: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MeddpiccService(
      prisma as unknown as PrismaService,
      { get: vi.fn() } as unknown as ConfigService,
      {} as AnthropicCredentialsService,
      {} as AnthropicClientService,
      {} as MeddpiccStorageService,
      {} as MeddpiccExtractService,
    );
  });

  it('no usa data.user_id como fallback para resolver el deal del webhook', async () => {
    const result = await service.ingestConvaiPostCallEvent({
      type: 'post_call_transcription',
      event_timestamp: 1_785_000_000,
      data: {
        conversation_id: 'conv_1',
        user_id: DEAL_ID,
        transcript: [{ role: 'user', message: 'Hola' }],
      },
    });

    expect(result).toEqual({ duplicate: false });
    expect(prisma.meddpiccDeal.findUnique).not.toHaveBeenCalled();
    expect(prisma.meddpiccDeal.update).not.toHaveBeenCalled();
  });

  it('acepta el webhook cuando dynamic_variables.deal_id coincide con un deal existente', async () => {
    prisma.meddpiccDeal.findUnique.mockResolvedValue({
      id: DEAL_ID,
      userId: 'user-1',
      notes: null,
    });
    prisma.meddpiccDeal.update.mockResolvedValue({});

    const result = await service.ingestConvaiPostCallEvent({
      type: 'post_call_transcription',
      event_timestamp: 1_785_000_000,
      data: {
        conversation_id: 'conv_1',
        user_id: DEAL_ID,
        transcript: [{ role: 'user', message: 'Hola' }],
        conversation_initiation_client_data: {
          dynamic_variables: { deal_id: DEAL_ID },
        },
      },
    });

    expect(result).toEqual({ duplicate: false });
    expect(prisma.meddpiccDeal.findUnique).toHaveBeenCalledWith({
      where: { id: DEAL_ID },
      select: { id: true, notes: true, userId: true },
    });
    expect(prisma.meddpiccDeal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DEAL_ID },
      }),
    );
  });
});
