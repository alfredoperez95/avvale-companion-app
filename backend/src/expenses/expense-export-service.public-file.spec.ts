import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseExportService } from './expense-export.service';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('ExpenseExportService public file access', () => {
  let service: ExpenseExportService;
  const prisma = {
    expenseMonthExport: {
      findFirst: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExpenseExportService(
      prisma as unknown as PrismaService,
      { get: vi.fn().mockReturnValue('/tmp/avvale-test-uploads') } as unknown as ConfigService,
    );
  });

  it('rechaza nombres de archivo que no pertenecen al lote exportado', async () => {
    prisma.expenseMonthExport.findFirst.mockResolvedValue({
      storagePath: 'expense-exports/token-1',
      expenseIds: ['expense-1'],
    });

    await expect(service.getPublicFile('token-1', 'expense-2_receipt.pdf')).rejects.toBeInstanceOf(NotFoundException);
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it('permite descargar archivos cuyo expenseId está en el lote exportado', async () => {
    prisma.expenseMonthExport.findFirst.mockResolvedValue({
      storagePath: 'expense-exports/token-1',
      expenseIds: ['expense-1'],
    });
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('pdf'));

    await expect(service.getPublicFile('token-1', 'expense-1_receipt.pdf')).resolves.toEqual({
      buffer: Buffer.from('pdf'),
      fileName: 'expense-1_receipt.pdf',
      contentType: 'application/pdf',
    });
    expect(fs.readFile).toHaveBeenCalledOnce();
  });
});
