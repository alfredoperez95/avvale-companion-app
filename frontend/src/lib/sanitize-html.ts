import DOMPurify from 'dompurify';

/**
 * Sanitiza HTML de usuario/correo antes de `dangerouslySetInnerHTML`.
 * Allowlist amplia para firmas/cuerpos de activación (tablas, imágenes, enlaces).
 */
export function sanitizeUserHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  });
}
