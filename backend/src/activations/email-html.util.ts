/** Normaliza HTML de cuerpo/firma para envío a Make (misma lógica que el servicio de activaciones). */
export function normalizeEmailHtmlSpacing(
  html: string | null,
  options?: { preserveTrailingBreaks?: boolean },
): string | null {
  if (!html?.trim()) return html ?? null;
  let out = html;
  const preserveTrailingBreaks = options?.preserveTrailingBreaks ?? false;
  out = out.replace(
    /<p\b[^>]*>\s*(?:&nbsp;|\s|<span>\s*&nbsp;\s*<\/span>|<span>\s*<\/span>|<br\s*\/?>)*\s*<\/p>/gi,
    '<br>',
  );
  out = out.replace(/<p\b[^>]*>/gi, '');
  out = out.replace(/<\/p>/gi, '<br>');
  out = out.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>');
  out = out.replace(/^\s*(?:<br\s*\/?>\s*)+/i, '');
  if (!preserveTrailingBreaks) {
    out = out.replace(/(?:<br\s*\/?>\s*)+\s*$/i, '');
  }
  return out;
}
