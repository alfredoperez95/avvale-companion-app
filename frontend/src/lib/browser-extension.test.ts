import { describe, expect, it } from 'vitest';
import { fileToBase64Payload, storeLocalFilesInExtension } from './browser-extension';

describe('fileToBase64Payload', () => {
  it('convierte un File local a descriptor base64 sin prefijo data', async () => {
    const file = new File(['hello'], 'oferta.pdf', { type: 'application/pdf' });

    const descriptor = await fileToBase64Payload(file, 'offer_pdf');

    expect(descriptor).toEqual({
      role: 'offer_pdf',
      name: 'oferta.pdf',
      mimeType: 'application/pdf',
      size: 5,
      dataBase64: 'aGVsbG8=',
    });
  });
});

describe('storeLocalFilesInExtension', () => {
  it('rechaza payload local sin PDF de oferta antes de contactar con la extensión', async () => {
    const result = await storeLocalFilesInExtension({
      batchId: 'batch-1',
      files: [
        {
          role: 'pfe_excel',
          name: 'PFE.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 4,
          dataBase64: 'UEs=',
        },
      ],
    });

    expect(result).toEqual({ ok: false, error: 'invalid_payload', timedOut: false });
  });
});

