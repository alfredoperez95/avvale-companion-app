import { describe, expect, it } from 'vitest';
import type { ClaudeOfferExtraction } from '@/types/yubiq';
import { YUBIQ_TARGETS } from '@/types/yubiq-payload';
import { buildYubiqPayload } from './build-yubiq-payload';
import { parseAmountAndCurrency } from './normalize-revenue';
import { normalizeSegment } from './normalize-segment';

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const sampleExtraction: ClaudeOfferExtraction = {
  titulo: 'Nueva Integración Be2bar',
  nombreCliente: 'Estrella Galicia',
  importeOferta: '2.680 €',
  areaCompania: 'SAIBORG',
  resumen: 'Implementación de integración MuleSoft.',
  observaciones: 'Notas.',
  confidence: {
    titulo: 0.95,
    nombreCliente: 0.9,
    importeOferta: 0.95,
    areaCompania: 0.98,
    resumen: 0.92,
  },
};

describe('parseAmountAndCurrency', () => {
  it('parsea euros europeos', () => {
    const r = parseAmountAndCurrency('2.680 €');
    expect(r.currency).toBe('EUR');
    expect(r.amount).toBe('2680');
    expect(r.revenue).toBe('2680');
  });
});

describe('normalizeSegment', () => {
  it('acepta mayúsculas', () => {
    expect(normalizeSegment('run').segment).toBe('RUN');
  });

  it('devuelve vacío y warning si no mapea', () => {
    const r = normalizeSegment('OTRO');
    expect(r.segment).toBe('');
    expect(r.warning).toBe('segment_unmapped');
  });
});

describe('buildYubiqPayload', () => {
  it('construye payload válido y estable', () => {
    const now = new Date('2026-04-02T14:32:01.234Z');
    const { payload, isValid, warnings, validationErrors } = buildYubiqPayload({
      extraction: sampleExtraction,
      fileName: 'oferta.pdf',
      now,
    });

    expect(isValid).toBe(true);
    expect(validationErrors).toEqual([]);

    expect(payload.schemaVersion).toBe('1.0.0');
    expect(payload.target).toBe('yubiq_addnew');
    expect(payload.targetUrl).toBe(YUBIQ_TARGETS.yubiq_addnew.targetUrl);
    expect(payload.generatedAt).toBe(now.toISOString());

    expect(payload.document.fileName).toBe('oferta.pdf');
    expect(payload.document.title).toBe('Nueva Integración Be2bar');
    expect(payload.document.client).toBe('Estrella Galicia');
    expect(payload.document.summary).toBe('Implementación de integración MuleSoft.');
    expect(payload.document.amount).toBe('2680');
    expect(payload.document.currency).toBe('EUR');
    expect(payload.document.regulatedArea).toBe('SAIBORG');

    expect(payload.prefill.title).toBe('Nueva Integración Be2bar - Estrella Galicia');
    expect(payload.prefill.description).toBe('Implementación de integración MuleSoft.');
    expect(payload.prefill.toBeSigned).toBe(localYmd(now));
    expect(payload.prefill.documentType).toBe('offer');
    expect(payload.prefill.customerName).toBe('Estrella Galicia');
    expect(payload.prefill.company).toBe('espana');
    expect(payload.prefill.segment).toBe('SAIBORG');
    expect(payload.prefill.revenue).toBe('2680');

    expect(warnings).not.toContain('currency_not_detected');

    expect(payload.companionMeta).toBeDefined();
    expect(payload.companionMeta?.schemaVersion).toBe('1.0.0');
    expect(payload.companionMeta?.isValid).toBe(true);
    expect(payload.companionMeta?.validationErrors).toEqual([]);
    expect(payload.companionMeta?.warnings).toEqual(warnings);
    expect(payload.companionMeta?.document).toEqual(payload.document);
  });

  it('puede omitir companionMeta para JSON mínimo', () => {
    const { payload } = buildYubiqPayload({
      extraction: sampleExtraction,
      fileName: 'x.pdf',
      now: new Date('2026-01-01T00:00:00.000Z'),
      includeCompanionMeta: false,
    });
    expect(payload.companionMeta).toBeUndefined();
  });

  it('advertencia si falta área', () => {
    const bad: ClaudeOfferExtraction = {
      ...sampleExtraction,
      areaCompania: null,
    };
    const { warnings, payload } = buildYubiqPayload({
      extraction: bad,
      fileName: 'x.pdf',
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(warnings).toContain('segment_empty');
    expect(payload.prefill.segment).toBe('');
  });

  it('advertencia si el área no está en la lista permitida', () => {
    const bad = {
      ...sampleExtraction,
      areaCompania: 'ZZZ',
    } as unknown as ClaudeOfferExtraction;
    const { warnings, payload } = buildYubiqPayload({
      extraction: bad,
      fileName: 'x.pdf',
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(warnings).toContain('segment_unmapped');
    expect(payload.prefill.segment).toBe('');
  });
});
