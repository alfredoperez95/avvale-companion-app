import { describe, expect, it } from 'vitest';
import { buildPrefillTitle } from './build-prefill-title';

describe('buildPrefillTitle', () => {
  it('combina título y cliente con guión', () => {
    expect(buildPrefillTitle('Oferta A', 'Cliente B')).toBe('Oferta A - Cliente B');
  });

  it('solo título si falta cliente', () => {
    expect(buildPrefillTitle('Solo título', '')).toBe('Solo título');
    expect(buildPrefillTitle('Solo título', '   ')).toBe('Solo título');
  });

  it('solo cliente si falta título', () => {
    expect(buildPrefillTitle('', 'ACME')).toBe('ACME');
  });

  it('vacío si ambos vacíos', () => {
    expect(buildPrefillTitle('', '')).toBe('');
  });

  it('normaliza espacios internos', () => {
    expect(buildPrefillTitle('  A  B  ', '  C  ')).toBe('A B - C');
  });
});
