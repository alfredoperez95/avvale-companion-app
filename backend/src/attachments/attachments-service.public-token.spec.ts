import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from './attachments.service';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
  rm: vi.fn(),
}));

describe('AttachmentsService public token access', () => {
  let service: AttachmentsService;
  const prisma = {
    activationAttachment: {
      findFirst: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AttachmentsService(
      prisma as unknown as PrismaService,
      { get: vi.fn().mockReturnValue('/tmp/avvale-test-uploads') } as unknown as ConfigService,
    );
  });

  it('rechaza tokens públicos que no tienen formato UUID sin consultar BD', async () => {
    await expect(service.getPublicAttachmentFileByToken('../bad-token')).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.activationAttachment.findFirst).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it('normaliza y consulta tokens UUID válidos', async () => {
    const token = '11111111-1111-4111-8111-111111111111';
    prisma.activationAttachment.findFirst.mockResolvedValue({
      storedPath: 'activations/a/file.pdf',
      fileName: 'file.pdf',
      contentType: 'application/pdf',
    });
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('pdf'));

    await expect(service.getPublicAttachmentFileByToken(` ${token} `)).resolves.toEqual({
      buffer: Buffer.from('pdf'),
      fileName: 'file.pdf',
      contentType: 'application/pdf',
    });

    expect(prisma.activationAttachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ publicToken: token }),
      }),
    );
  });
});
