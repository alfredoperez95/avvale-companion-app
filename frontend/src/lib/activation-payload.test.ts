import { describe, expect, it } from 'vitest';
import { mapExtensionServiceTypeToProjectType } from './activation-payload';

describe('mapExtensionServiceTypeToProjectType', () => {
  it('mapea Consulting a CONSULTORIA', () => {
    expect(mapExtensionServiceTypeToProjectType('Consulting')).toBe('CONSULTORIA');
  });

  it('mapea Software a SW', () => {
    expect(mapExtensionServiceTypeToProjectType('Software')).toBe('SW');
  });

  it('mapea Software / Product (HubSpot) a SW', () => {
    expect(mapExtensionServiceTypeToProjectType('Software / Product')).toBe('SW');
  });

  it('normaliza espacios en Software / Product', () => {
    expect(mapExtensionServiceTypeToProjectType('Software  /  Product')).toBe('SW');
  });

  it('devuelve cadena vacía para desconocido o vacío', () => {
    expect(mapExtensionServiceTypeToProjectType(undefined)).toBe('');
    expect(mapExtensionServiceTypeToProjectType('')).toBe('');
    expect(mapExtensionServiceTypeToProjectType('Otro')).toBe('');
  });
});
