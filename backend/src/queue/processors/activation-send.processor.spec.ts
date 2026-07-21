import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivationSendOrchestrator } from '../../activations/activation-send.orchestrator';
import { ActivationSendProcessor } from './activation-send.processor';

describe('ActivationSendProcessor', () => {
  let processor: ActivationSendProcessor;
  const prisma = {
    activation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  const orchestrator = {
    deliverActivationToMake: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new ActivationSendProcessor(
      prisma as unknown as PrismaService,
      orchestrator as unknown as ActivationSendOrchestrator,
    );
  });

  it('rechaza jobs cuyo userId no coincide con el creador de la activación', async () => {
    prisma.activation.findUnique.mockResolvedValue({
      createdByUserId: 'owner-1',
      processingStartedAt: null,
      status: 'QUEUED',
    });

    await expect(
      processor.process({
        id: 'job-1',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: { activationId: 'activation-1', userId: 'other-user' },
      } as never),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(prisma.activation.update).not.toHaveBeenCalled();
    expect(orchestrator.deliverActivationToMake).not.toHaveBeenCalled();
  });
});
