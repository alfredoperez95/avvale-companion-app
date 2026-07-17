import { describe, expect, it, afterEach } from 'vitest';
import { assertProductionSecrets } from './assert-production-secrets';

describe('assertProductionSecrets', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('no hace nada fuera de producción', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    expect(() => assertProductionSecrets()).not.toThrow();
  });

  it('aborta en producción con secreto débil', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'change-me-in-production';
    process.env.CORS_ORIGIN = 'https://www.avvalecompanion.app';
    expect(() => assertProductionSecrets()).toThrow(/JWT_SECRET/);
  });

  it('aborta en producción sin CORS_ORIGIN', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(40);
    process.env.MAGIC_LINK_SECRET = 'b'.repeat(40);
    delete process.env.CORS_ORIGIN;
    expect(() => assertProductionSecrets()).toThrow(/CORS_ORIGIN/);
  });

  it('pasa con secretos fuertes y CORS', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(40);
    process.env.MAGIC_LINK_SECRET = 'b'.repeat(40);
    process.env.CORS_ORIGIN = 'https://www.avvalecompanion.app';
    expect(() => assertProductionSecrets()).not.toThrow();
  });
});
