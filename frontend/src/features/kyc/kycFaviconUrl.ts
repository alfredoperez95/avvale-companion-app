/**
 * URL de favicon a partir del sitio de la ficha.
 * Usa faviconV2 de gstatic con la URL del sitio en https.
 */
export function faviconUrlFromWebsite(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    const hostname = u.hostname;
    if (!hostname || hostname === 'localhost') return null;
    const pageUrl = `https://${hostname}`;
    const params = new URLSearchParams({
      client: 'SOCIAL',
      type: 'FAVICON',
      fallback_opts: 'TYPE,SIZE,URL',
      url: pageUrl,
      size: '128',
    });
    return `https://t3.gstatic.com/faviconV2?${params.toString()}`;
  } catch {
    return null;
  }
}
