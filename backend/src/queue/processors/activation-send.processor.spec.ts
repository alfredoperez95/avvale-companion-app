import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivationSendOrchestrator } from '../../activations/activation-send.orchestrator';
import { ActivationSendProcessor } from './activation-send.processor';

describe('ActivationSendProcessor', () => {
  let processor: ActivationSendProcessor;
  const prisma = {
    $queryRawUnsafe: vi.fn(),
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

  it('no marca FAILED en onFailed si el job no pertenece al creador de la activación', async () => {
    prisma.activation.findUnique.mockResolvedValue({ createdByUserId: 'owner-1' });

    await processor.onFailed(
      {
        id: 'job-1',
        attemptsMade: 1,
        opts: { attempts: 3 },
        data: { activationId: 'activation-1', userId: 'other-user' },
      } as never,
      new UnrecoverableError('userId no coincide con la activación'),
    );

    expect(prisma.activation.findUnique).toHaveBeenCalledWith({
      where: { id: 'activation-1' },
      select: { createdByUserId: true },
    });
    expect(prisma.activation.update).not.toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('marca FAILED en onFailed no recuperable tras revalidar el propietario del job', async () => {
    prisma.activation.findUnique.mockResolvedValue({ createdByUserId: 'owner-1' });
    prisma.$queryRawUnsafe.mockResolvedValue([{ COLUMN_TYPE: 'varchar(255)', CHARACTER_MAXIMUM_LENGTH: 255 }]);

    await processor.onFailed(
      {
        id: 'job-1',
        attemptsMade: 1,
        opts: { attempts: 3 },
        data: { activationId: 'activation-1', userId: 'owner-1' },
      } as never,
      new UnrecoverableError('fallo definitivo'),
    );

    expect(prisma.activation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'activation-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'fallo definitivo',
        }),
      }),
    );
  });
});
