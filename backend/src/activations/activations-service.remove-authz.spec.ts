import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttachmentsService } from '../attachments/attachments.service';
import { BillingAdminContactsService } from '../billing-admin-contacts/billing-admin-contacts.service';
import { EmailSignatureService } from '../email-signature/email-signature.service';
import { ActivationLookupService } from './activation-lookup.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivationSendProducer } from '../queue/producers/activation-send-producer.service';
import { ActivationsService } from './activations.service';

describe('ActivationsService.remove', () => {
  let service: ActivationsService;
  const prisma = {
    activation: { delete: vi.fn() },
  };
  const attachments = {
    deleteAttachmentsForActivation: vi.fn(),
  };
  const lookup = {
    findOneById: vi.fn(),
    findOneByIdAndUser: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    lookup.findOneById.mockResolvedValue({ id: 'activation-1' });
    lookup.findOneByIdAndUser.mockResolvedValue({ id: 'activation-1' });
    service = new ActivationsService(
      prisma as unknown as PrismaService,
      { get: vi.fn() } as unknown as ConfigService,
      attachments as unknown as AttachmentsService,
      {} as BillingAdminContactsService,
      {} as EmailSignatureService,
      lookup as unknown as ActivationLookupService,
      {} as ActivationSendProducer,
    );
  });

  it('permite a un admin borrar una activación sin filtrar por creador', async () => {
    await service.remove('activation-1', {
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN',
    });

    expect(lookup.findOneById).toHaveBeenCalledWith('activation-1');
    expect(lookup.findOneByIdAndUser).not.toHaveBeenCalled();
    expect(attachments.deleteAttachmentsForActivation).toHaveBeenCalledWith('activation-1');
    expect(prisma.activation.delete).toHaveBeenCalledWith({ where: { id: 'activation-1' } });
  });

  it('mantiene el borrado de usuario normal limitado a sus propias activaciones', async () => {
    await service.remove('activation-1', {
      userId: 'user-1',
      email: 'user@example.com',
      role: 'USER',
    });

    expect(lookup.findOneByIdAndUser).toHaveBeenCalledWith('activation-1', 'user-1');
    expect(lookup.findOneById).not.toHaveBeenCalled();
    expect(attachments.deleteAttachmentsForActivation).toHaveBeenCalledWith('activation-1');
    expect(prisma.activation.delete).toHaveBeenCalledWith({ where: { id: 'activation-1' } });
  });
});
