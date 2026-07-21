import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { BulkDeleteExpensesDto } from './dto/bulk-delete-expenses.dto';

const UUID_A = '11111111-1111-4111-8111-111111111111';

function dtoWithIds(count: number): BulkDeleteExpensesDto {
  return plainToInstance(BulkDeleteExpensesDto, {
    ids: Array.from({ length: count }, (_, index) =>
      `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`,
    ),
  });
}

describe('BulkDeleteExpensesDto', () => {
  it('acepta hasta 100 ids', async () => {
    const errors = await validate(dtoWithIds(100));
    expect(errors).toHaveLength(0);
  });

  it('rechaza más de 100 ids', async () => {
    const errors = await validate(dtoWithIds(101));
    expect(errors.some((err) => err.constraints?.arrayMaxSize)).toBe(true);
  });

  it('rechaza ids no UUID', async () => {
    const dto = plainToInstance(BulkDeleteExpensesDto, { ids: [UUID_A, 'no-es-uuid'] });
    const errors = await validate(dto);
    expect(errors.some((err) => err.constraints?.isUuid)).toBe(true);
  });
});
