import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { validateActivationAttachmentFile } from './validate-activation-attachment';

describe('validateActivationAttachmentFile', () => {
  it('acepta PDF y Office', () => {
    expect(() =>
      validateActivationAttachmentFile({
        originalname: 'oferta.pdf',
        mimetype: 'application/pdf',
      }),
    ).not.toThrow();
    expect(() =>
      validateActivationAttachmentFile({
        originalname: 'doc.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ).not.toThrow();
  });

  it('rechaza ejecutables', () => {
    expect(() =>
      validateActivationAttachmentFile({
        originalname: 'malware.exe',
        mimetype: 'application/octet-stream',
      }),
    ).toThrow(BadRequestException);
  });
});
