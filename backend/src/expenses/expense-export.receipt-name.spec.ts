import { describe, expect, it } from 'vitest';
import { buildExportReceiptFileName } from './expense-export.service';

describe('buildExportReceiptFileName', () => {
  it('keeps a reliable PDF file name', () => {
    expect(
      buildExportReceiptFileName({
        id: 'exp-1',
        originalFileName: 'TicketFredys.pdf',
        mimeType: 'application/pdf',
      }),
    ).toBe('exp-1_TicketFredys.pdf');
  });

  it('forces .pdf when mime is PDF but original name has an image extension', () => {
    expect(
      buildExportReceiptFileName({
        id: 'exp-2',
        originalFileName: 'recibo.jpg',
        mimeType: 'application/pdf',
      }),
    ).toBe('exp-2_recibo.pdf');
  });

  it('forces .pdf when mime is PDF and original name has no extension', () => {
    expect(
      buildExportReceiptFileName({
        id: 'exp-3',
        originalFileName: 'TicketFredys',
        mimeType: 'application/pdf',
      }),
    ).toBe('exp-3_TicketFredys.pdf');
  });

  it('uses recibo-<id>.pdf when PDF has no usable original name', () => {
    expect(
      buildExportReceiptFileName({
        id: 'exp-4',
        originalFileName: '',
        mimeType: 'application/pdf',
      }),
    ).toBe('exp-4_recibo-exp-4.pdf');
  });

  it('detects PDF from original extension even if mime is missing', () => {
    expect(
      buildExportReceiptFileName({
        id: 'exp-5',
        originalFileName: 'factura.pdf',
        mimeType: '',
      }),
    ).toBe('exp-5_factura.pdf');
  });

  it('detects PDF mime even with charset parameters', () => {
    expect(
      buildExportReceiptFileName({
        id: 'exp-8',
        originalFileName: 'TicketFredys',
        mimeType: 'application/pdf; charset=binary',
      }),
    ).toBe('exp-8_TicketFredys.pdf');
  });

  it('keeps jpeg extension for image receipts', () => {
    expect(
      buildExportReceiptFileName({
        id: 'exp-6',
        originalFileName: 'comida.heic',
        mimeType: 'image/jpeg',
      }),
    ).toBe('exp-6_comida.jpg');
  });

  it('keeps png extension for png receipts', () => {
    expect(
      buildExportReceiptFileName({
        id: 'exp-7',
        originalFileName: 'ticket.png',
        mimeType: 'image/png',
      }),
    ).toBe('exp-7_ticket.png');
  });
});
