import DOMPurify from 'dompurify';

function enforceBlankTargetRel(html: string): string {
  return html.replace(/<a\b([^>]*\btarget=(?:"_blank"|'_blank'|_blank)[^>]*)>/gi, (match, attrs: string) => {
    const relMatch = attrs.match(/\brel=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (relMatch) {
      const relValue = relMatch[1] ?? relMatch[2] ?? relMatch[3] ?? '';
      const secureRel = Array.from(new Set(`${relValue} noopener noreferrer`.trim().split(/\s+/))).join(' ');
      return `<a${attrs.replace(/\brel=(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `rel="${secureRel}"`)}>`;
    }
    return `<a${attrs} rel="noopener noreferrer">`;
  });
}

/**
 * Sanitiza HTML de usuario/correo antes de `dangerouslySetInnerHTML`.
 * Allowlist amplia para firmas/cuerpos de activación (tablas, imágenes, enlaces).
 */
export function sanitizeUserHtml(html: string): string {
  if (!html) return '';
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  });
  return enforceBlankTargetRel(sanitized);
}

/**
 * Sanitización restrictiva para HTML generado por formatters internos (p. ej. markdown ligero).
 */
export function sanitizeRestrictedHtml(html: string, allowedTags: string[]): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
  });
}
