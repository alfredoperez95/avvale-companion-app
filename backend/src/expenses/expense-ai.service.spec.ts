import { describe, expect, it } from 'vitest';
import { hasUsablePdfText, parseExtraction } from './expense-ai.service';

describe('expense-ai consolidation', () => {
  it('sums receiptAmounts into the global amount', () => {
    const result = parseExtraction(
      JSON.stringify({
        amount: 0,
        receiptAmounts: [14.5, 118.4, 6.3, 56.4],
        expenseType: 'Meals for External Activities',
        description: '4 tickets en La Cantina de Fredy\'s',
        date: '2026-07-16',
      }),
      'test-model',
    );

    expect(result.amount).toBe(195.6);
    expect(result.type).toBe('Meals for External Activities');
    expect(result.date).toBe('2026-07-16');
  });

  it('falls back to amount when receiptAmounts is missing', () => {
    const result = parseExtraction(
      JSON.stringify({
        amount: 42.5,
        expenseType: 'Taxi',
        description: 'Taxi al aeropuerto',
        date: '2026-07-01',
      }),
      'test-model',
    );

    expect(result.amount).toBe(42.5);
  });

  it('parses European decimal strings inside receiptAmounts', () => {
    const result = parseExtraction(
      JSON.stringify({
        amount: null,
        receiptAmounts: ['14,50', '118,40'],
        expenseType: 'Meals for External Activities',
        description: '2 tickets',
        date: '2026-07-16',
      }),
      'test-model',
    );

    expect(result.amount).toBe(132.9);
  });

  it('rejects empty PDF page markers as unusable text', () => {
    expect(
      hasUsablePdfText(`
-- 1 of 4 --

-- 2 of 4 --
`),
    ).toBe(false);
  });

  it('accepts real PDF text content', () => {
    expect(hasUsablePdfText('FRASOVY HOSTELERIA, SL Total: 14,50 EUR Mesa 217')).toBe(true);
  });
});
