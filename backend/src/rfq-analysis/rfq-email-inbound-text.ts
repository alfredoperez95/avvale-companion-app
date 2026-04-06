/**
 * Texto opcional del webhook RFQ email (Make): trim; cadena vacía → undefined.
 */
export function sanitizeInboundEmailText(raw: string | undefined | null): string | undefined {
  if (raw == null || typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Normaliza para comparar cuerpo vs hilo: saltos de línea, espacios múltiples, minúsculas.
 * No altera el texto que se persiste en fuentes; solo sirve para detectar duplicados.
 */
export function normalizeTextForEmailDedup(s: string): string {
  return s
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .toLowerCase();
}

/**
 * Indica si dos textos son el mismo contenido “visible” (evita duplicar hilo = cuerpo).
 */
export function areInboundEmailTextsEquivalent(a: string | undefined, b: string | undefined): boolean {
  if (a == null || b == null) return false;
  return normalizeTextForEmailDedup(a) === normalizeTextForEmailDedup(b);
}

/**
 * Ensambla un bloque de contexto de email para trazabilidad / futuros usos (no sustituye fuentes en BD).
 * Orden: asunto → cuerpo → hilo adicional (solo si distinto del cuerpo).
 */
export function buildEmailInboundContextPreview(input: {
  subject?: string;
  bodyPlain?: string;
  threadContext?: string;
}): string {
  const lines: string[] = [];
  const sub = sanitizeInboundEmailText(input.subject);
  if (sub) lines.push(`Asunto: ${sub}`);
  const body = sanitizeInboundEmailText(input.bodyPlain);
  if (body) lines.push(`Cuerpo:\n${body}`);
  const thread = sanitizeInboundEmailText(input.threadContext);
  if (thread && !areInboundEmailTextsEquivalent(body, thread)) {
    lines.push(`Contexto del hilo de correo (adicional):\n${thread}`);
  }
  return lines.join('\n\n');
}
