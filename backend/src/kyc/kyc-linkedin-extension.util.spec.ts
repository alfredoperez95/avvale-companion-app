import { describe, expect, it } from 'vitest';
import {
  buildLinkedInCaptureNotes,
  mapExtensionLevelLabel,
  normalizeLinkedInProfileUrl,
  splitDisplayNameForContact,
} from './kyc-linkedin-extension.util';

describe('normalizeLinkedInProfileUrl', () => {
  it('canoniza host www y minúsculas, sin query', () => {
    expect(normalizeLinkedInProfileUrl('HTTPS://WWW.Linkedin.COM/in/Foo-Bar/?trk=1')).toBe(
      'https://www.linkedin.com/in/foo-bar',
    );
  });

  it('devuelve vacío si no hay entrada', () => {
    expect(normalizeLinkedInProfileUrl('')).toBe('');
    expect(normalizeLinkedInProfileUrl(undefined)).toBe('');
  });
});

describe('mapExtensionLevelLabel', () => {
  it('mapea etiquetas conocidas', () => {
    expect(mapExtensionLevelLabel('C-Suite')).toBe(1);
    expect(mapExtensionLevelLabel('VP / Dirección')).toBe(2);
    expect(mapExtensionLevelLabel('Director / Head')).toBe(3);
    expect(mapExtensionLevelLabel('Manager')).toBe(4);
    expect(mapExtensionLevelLabel('IC / Analyst')).toBe(5);
    expect(mapExtensionLevelLabel('Sin asignar')).toBeNull();
  });

  it('devuelve undefined si no reconoce el nivel', () => {
    expect(mapExtensionLevelLabel('nivel galáctico')).toBeUndefined();
  });
});

describe('buildLinkedInCaptureNotes', () => {
  it('trunca a ~2000 caracteres cuando el conjunto supera el límite', () => {
    const out = buildLinkedInCaptureNotes({
      headline: 'h'.repeat(1900),
      rawText: 'r'.repeat(500),
    })!;
    expect(out.length).toBeLessThanOrEqual(2000);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('splitDisplayNameForContact', () => {
  it('divide primera palabra y resto', () => {
    expect(splitDisplayNameForContact('María García López')).toEqual({
      firstName: 'María',
      lastName: 'García López',
    });
  });
});
