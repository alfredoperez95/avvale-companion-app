import { describe, expect, it } from 'vitest';
import { validateSafeFile } from './safe-file-validation';
import { resolvePathWithinBase } from './safe-path';

const validPdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\nstartxref\n0\n%%EOF\n', 'utf8');
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);

describe('validateSafeFile', () => {
  it('acepta PDF real y renombra con UUID/extensión canónica', () => {
    const result = validateSafeFile('yubiq', {
      buffer: validPdf,
      originalname: 'Oferta Cliente.pdf',
      mimetype: 'application/pdf',
    });

    expect(result.contentType).toBe('application/pdf');
    expect(result.displayName).toBe('Oferta Cliente.pdf');
    expect(result.storedFileName).toMatch(/^[0-9a-f-]{36}\.pdf$/);
  });

  it('rechaza PDF incompleto o malformado', () => {
    expect(() =>
      validateSafeFile('yubiq', {
        buffer: Buffer.from('%PDF-1.7\nsin eof', 'utf8'),
        originalname: 'bad.pdf',
        mimetype: 'application/pdf',
      }),
    ).toThrow(/PDF/);
  });

  it('bloquea extensiones peligrosas aunque aparezcan como doble extensión', () => {
    expect(() =>
      validateSafeFile('activation', {
        buffer: validPdf,
        originalname: 'factura.pdf.html',
        mimetype: 'application/pdf',
      }),
    ).toThrow(/Extensión/);
  });

  it('bloquea SVG, HTML, JavaScript, PHP y ejecutables renombrados', () => {
    const samples = [
      { name: 'icon.svg', mime: 'image/svg+xml', body: '<svg></svg>' },
      { name: 'page.txt', mime: 'text/plain', body: '<html><script>alert(1)</script></html>' },
      { name: 'code.js', mime: 'application/javascript', body: 'alert(1)' },
      { name: 'shell.php', mime: 'text/plain', body: '<?php echo 1;' },
      { name: 'malware.pdf', mime: 'application/pdf', body: 'MZ...' },
    ];

    for (const sample of samples) {
      expect(() =>
        validateSafeFile('activation', {
          buffer: Buffer.from(sample.body, 'utf8'),
          originalname: sample.name,
          mimetype: sample.mime,
        }),
      ).toThrow();
    }
  });

  it('rechaza imagen cuya firma real no coincide con extensión', () => {
    expect(() =>
      validateSafeFile('avatar', {
        buffer: validPdf,
        originalname: 'avatar.png',
        mimetype: 'image/png',
      }),
    ).toThrow(/contenido real|Imagen/);
  });

  it('acepta imagen raster con firma permitida', () => {
    const result = validateSafeFile('avatar', {
      buffer: png,
      originalname: 'avatar.png',
      mimetype: 'image/png',
    });

    expect(result.contentType).toBe('image/png');
  });
});

describe('resolvePathWithinBase', () => {
  it('resuelve rutas internas', () => {
    expect(resolvePathWithinBase('/tmp/uploads', 'expenses/a/file.pdf')).toBe('/tmp/uploads/expenses/a/file.pdf');
  });

  it('bloquea path traversal y rutas absolutas', () => {
    expect(() => resolvePathWithinBase('/tmp/uploads', '../etc/passwd')).toThrow();
    expect(() => resolvePathWithinBase('/tmp/uploads', '/etc/passwd')).toThrow();
  });
});
