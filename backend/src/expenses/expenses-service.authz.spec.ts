import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpenseSource, ExpenseStatus, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicCredentialsService } from '../ai-credentials/anthropic/anthropic-credentials.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseExtractProducer } from '../queue/producers/expense-extract-producer.service';
import { ExpenseAiService } from './expense-ai.service';
import { ExpenseStorageService } from './expense-storage.service';
import { ExpensesService } from './expenses.service';

const now = new Date('2026-07-21T10:45:00.000Z');

function expenseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'expense-1',
    userId: 'user-1',
    amount: new Prisma.Decimal(12.34),
    type: 'Taxi',
    description: 'Taxi cliente',
    date: now,
    paidByCompany: false,
    loaded: false,
    fileUrl: '/uploads/expense-1/receipt.pdf',
    originalFileName: 'receipt.pdf',
    storagePath: 'expenses/expense-1/receipt.pdf',
    mimeType: 'application/pdf',
    status: ExpenseStatus.PROCESSED,
    source: ExpenseSource.MANUAL,
    extractionError: null,
    rawModelOutput: null,
    modelId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ExpensesService ownership hardening', () => {
  let service: ExpensesService;
  const prisma = {
    expense: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  const storage = {
    deleteExpenseFolder: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExpensesService(
      prisma as unknown as PrismaService,
      { get: vi.fn() } as unknown as ConfigService,
      {} as AnthropicCredentialsService,
      storage as unknown as ExpenseStorageService,
      {} as ExpenseAiService,
      {} as ExpenseExtractProducer,
    );
  });

  it('actualiza un gasto con where id + userId y devuelve el registro del propietario', async () => {
    prisma.expense.updateMany.mockResolvedValue({ count: 1 });
    prisma.expense.findFirst.mockResolvedValue(expenseRow({ description: 'Taxi actualizado' }));

    const result = await service.update('user-1', 'expense-1', {
      amount: 12.34,
      type: 'Taxi',
      description: 'Taxi actualizado',
      date: '2026-07-21',
    });

    expect(prisma.expense.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'expense-1', userId: 'user-1' },
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'expense-1', description: 'Taxi actualizado' }));
  });

  it('no actualiza un gasto si id + userId no coinciden', async () => {
    prisma.expense.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.update('other-user', 'expense-1', {
        amount: 12.34,
        type: 'Taxi',
        description: 'Taxi',
        date: '2026-07-21',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.expense.findFirst).not.toHaveBeenCalled();
  });

  it('borra un gasto con where id + userId antes de eliminar su carpeta', async () => {
    prisma.expense.findFirst.mockResolvedValue(expenseRow());
    prisma.expense.deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.remove('user-1', 'expense-1')).resolves.toEqual({ ok: true });

    expect(prisma.expense.deleteMany).toHaveBeenCalledWith({ where: { id: 'expense-1', userId: 'user-1' } });
    expect(storage.deleteExpenseFolder).toHaveBeenCalledWith('expense-1');
  });

  it('no elimina la carpeta si el borrado por id + userId no afecta filas', async () => {
    prisma.expense.findFirst.mockResolvedValue(expenseRow());
    prisma.expense.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove('user-1', 'expense-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.deleteExpenseFolder).not.toHaveBeenCalled();
  });
});
