import { describe, expect, it } from 'vitest';
import { isExcludedFromInternalOrgChart } from './kyc-org-chart-eligibility.util';

describe('isExcludedFromInternalOrgChart', () => {
  it('excluye área exacta competencia', () => {
    expect(
      isExcludedFromInternalOrgChart({
        name: 'Ana',
        role: 'CTO',
        area: 'competencia',
        notes: null,
      }),
    ).toBe(true);
  });

  it('no excluye perfiles internos típicos', () => {
    expect(
      isExcludedFromInternalOrgChart({
        name: 'Ana',
        role: 'Director de IT',
        area: 'Technology',
        notes: null,
      }),
    ).toBe(false);
  });

  it('detecta partner tecnológico en notas', () => {
    expect(
      isExcludedFromInternalOrgChart({
        name: 'Bob',
        role: 'Consultor',
        area: null,
        notes: 'technology partner principal del proyecto',
      }),
    ).toBe(true);
  });
});
