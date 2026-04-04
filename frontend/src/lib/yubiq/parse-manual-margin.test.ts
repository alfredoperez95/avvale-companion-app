import { describe, expect, it } from 'vitest';
import { parseManualMarginToNumber } from './parse-manual-margin';

describe('parseManualMarginToNumber', () => {
  it('devuelve undefined para vacío o undefined', () => {
    expect(parseManualMarginToNumber(undefined)).toBeUndefined();
    expect(parseManualMarginToNumber('')).toBeUndefined();
    expect(parseManualMarginToNumber('   ')).toBeUndefined();
  });

  it('devuelve enteros 0–100 y quita %', () => {
    expect(parseManualMarginToNumber('15')).toBe(15);
    expect(parseManualMarginToNumber('15%')).toBe(15);
    expect(parseManualMarginToNumber('  20 % ')).toBe(20);
    expect(parseManualMarginToNumber('0')).toBe(0);
    expect(parseManualMarginToNumber('100')).toBe(100);
  });

  it('redondea al entero más cercano', () => {
    expect(parseManualMarginToNumber('34,1')).toBe(34);
    expect(parseManualMarginToNumber('35.8')).toBe(36);
    expect(parseManualMarginToNumber('67.4')).toBe(67);
    expect(parseManualMarginToNumber('12,5')).toBe(13);
  });

  it('acota al rango 0–100 antes de redondear', () => {
    expect(parseManualMarginToNumber('150')).toBe(100);
    expect(parseManualMarginToNumber('-5')).toBe(0);
    expect(parseManualMarginToNumber('99,6')).toBe(100);
  });

  it('devuelve undefined si no hay número válido', () => {
    expect(parseManualMarginToNumber('abc')).toBeUndefined();
    expect(parseManualMarginToNumber('%')).toBeUndefined();
  });
});
