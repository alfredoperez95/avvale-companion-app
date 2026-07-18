import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, buildSecurityHeaders, collectConnectOrigins } from './csp';

describe('buildContentSecurityPolicy', () => {
  it('incluye nonce y strict-dynamic; sin inline/eval/hosts externos en producción', () => {
    const csp = buildContentSecurityPolicy('testNonce123', { isDev: false });
    expect(csp).toContain("script-src");
    expect(csp).toContain("'nonce-testNonce123'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('https://unpkg.com');
    expect(csp).toContain("style-src 'self' 'nonce-testNonce123'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain('frame-src blob: https://*.elevenlabs.io');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('report-uri /api/csp-report');
    expect(csp).toContain('report-to csp-endpoint');
  });

  it('permite unsafe-eval solo en desarrollo (HMR)', () => {
    const csp = buildContentSecurityPolicy('devNonce', { isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain('ws://localhost:3000');
  });

  it('no permite hosts típicos de ClearFake/EtherHiding en connect-src', () => {
    const csp = buildContentSecurityPolicy('n', { isDev: false });
    expect(csp).not.toMatch(/bsc-testnet|publicnode|yandex|hazaratbet|fontawesome\.com/i);
  });

  it('incluye orígenes de API configurados', () => {
    const origins = collectConnectOrigins(['https://api.example.com/v1']);
    expect(origins).toContain('https://api.example.com');
    const csp = buildContentSecurityPolicy('n', {
      isDev: false,
      connectOrigins: ['https://api.example.com'],
    });
    expect(csp).toContain('https://api.example.com');
  });
});

describe('buildSecurityHeaders', () => {
  it('añade HSTS solo fuera de desarrollo', () => {
    const csp = buildContentSecurityPolicy('n', { isDev: false });
    const prod = buildSecurityHeaders(csp, { isDev: false });
    const dev = buildSecurityHeaders(csp, { isDev: true });
    expect(prod.some((h) => h.key === 'Strict-Transport-Security')).toBe(true);
    expect(dev.some((h) => h.key === 'Strict-Transport-Security')).toBe(false);
    expect(prod.some((h) => h.key === 'Cross-Origin-Resource-Policy')).toBe(true);
  });

  it('emite Report-Only por defecto y Enforce cuando se solicita', () => {
    const csp = buildContentSecurityPolicy('n', { isDev: false });
    const reportOnly = buildSecurityHeaders(csp, { isDev: false });
    const enforce = buildSecurityHeaders(csp, { isDev: false, mode: 'enforce' });

    expect(reportOnly.some((h) => h.key === 'Content-Security-Policy-Report-Only')).toBe(true);
    expect(reportOnly.some((h) => h.key === 'Content-Security-Policy')).toBe(false);
    expect(enforce.some((h) => h.key === 'Content-Security-Policy')).toBe(true);
    expect(enforce.some((h) => h.key === 'Content-Security-Policy-Report-Only')).toBe(false);
    expect(enforce.some((h) => h.key === 'Report-To')).toBe(true);
  });
});
