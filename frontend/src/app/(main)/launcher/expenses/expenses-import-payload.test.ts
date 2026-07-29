import { describe, expect, it } from 'vitest';
import { isHttpUrl, normalizeExpensesImportPayload } from './expenses-import-payload';

describe('normalizeExpensesImportPayload', () => {
  it('forces .pdf on PDF receipts and rewrites export URLs to same origin', () => {
    const normalized = normalizeExpensesImportPayload(
      {
        expenses: [
          {
            id: 'exp-1',
            fecha: '2026-07-16',
            importe: 14.5,
            tipo: 'Meals for External Activities',
            descripcion: 'Ticket',
            estado: 'processed',
            nombre_archivo: 'exp-1_TicketFredys',
            url_recibo: 'http://backend:4000/public/expense-exports/token-1/exp-1_TicketFredys.pdf',
            caduca_en: '2026-07-29T12:00:00.000Z',
            paid_by_company: false,
          },
        ],
        meta: { source: 'companion-app', batchId: 'token-1' },
      },
      [{ id: 'exp-1', originalFileName: 'TicketFredys.pdf', mimeType: 'application/pdf' }],
      'https://www.avvalecompanion.app',
    );

    expect(normalized.expenses[0].nombre_archivo).toBe('exp-1_TicketFredys.pdf');
    expect(normalized.expenses[0].url_recibo).toBe(
      'https://www.avvalecompanion.app/api/public/expense-exports/token-1/exp-1_TicketFredys.pdf',
    );
    expect(isHttpUrl(normalized.expenses[0].url_recibo, 'https://www.avvalecompanion.app')).toBe(true);
  });

  it('rebuilds url_recibo from batchId when missing but file name exists', () => {
    const normalized = normalizeExpensesImportPayload(
      {
        expenses: [
          {
            id: 'exp-2',
            fecha: '2026-07-16',
            importe: 10,
            tipo: 'Taxi',
            descripcion: 'Taxi',
            estado: 'processed',
            nombre_archivo: 'exp-2_recibo.pdf',
            url_recibo: '',
            caduca_en: '2026-07-29T12:00:00.000Z',
            paid_by_company: false,
          },
        ],
        meta: { batchId: 'token-2' },
      },
      [{ id: 'exp-2', mimeType: 'application/pdf', originalFileName: 'recibo.pdf' }],
      'https://app.example',
    );

    expect(normalized.expenses[0].url_recibo).toBe(
      'https://app.example/api/public/expense-exports/token-2/exp-2_recibo.pdf',
    );
  });
});
