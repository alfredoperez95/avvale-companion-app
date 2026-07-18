import { describe, expect, it, vi } from 'vitest';

vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html: string) =>
      html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/javascript:/gi, ''),
    ),
  },
}));

import DOMPurify from 'dompurify';
import { sanitizeRestrictedHtml, sanitizeUserHtml } from './sanitize-html';
import { formatKycAssistantMessageHtml } from '@/features/kyc/kycChatMessageFormat';

describe('sanitizeUserHtml', () => {
  it('sanitiza HTML y refuerza enlaces target blank con rel seguro', () => {
    const html = sanitizeUserHtml(
      '<a href="https://example.com" target="_blank" rel="nofollow">ok</a><img src=x onerror=alert(1)><script>alert(1)</script>',
    );

    expect(html).toContain('rel="nofollow noopener noreferrer"');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script');
  });

  it('usa DOMPurify como paso de sanitización', () => {
    sanitizeRestrictedHtml('<p>ok</p>', ['p']);

    expect(DOMPurify.sanitize).toHaveBeenCalled();
  });
});

describe('formatKycAssistantMessageHtml', () => {
  it('escapa HTML de entrada y conserva solo formato ligero permitido', () => {
    const html = formatKycAssistantMessageHtml('## Título\n- <img src=x onerror=alert(1)> **ok**');

    expect(html).toContain('<h2>Título</h2>');
    expect(html).toContain('<strong>ok</strong>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('onerror');
    expect(html).toContain('&lt;img');
  });
});
