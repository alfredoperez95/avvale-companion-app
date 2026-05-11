/**
 * URL de favicon a partir del sitio de la ficha.
 * Usa faviconV2 de gstatic con la URL del sitio en https.
 */

function googleFaviconV2Url(pageUrlHttps: string): string {
  const params = new URLSearchParams({
    client: 'SOCIAL',
    type: 'FAVICON',
    fallback_opts: 'TYPE,SIZE,URL',
    url: pageUrlHttps,
    size: '128',
  });
  return `https://t3.gstatic.com/faviconV2?${params.toString()}`;
}

export function faviconUrlFromWebsite(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    const hostname = u.hostname;
    if (!hostname || hostname === 'localhost') return null;
    return googleFaviconV2Url(`https://${hostname}`);
  } catch {
    return null;
  }
}

/**
 * Segunda URL para `<img onError>`: si la web es `www.*`, muchos favicons viven solo en el apex
 * y gstatic devuelve vacío con `url=https://www…` (p. ej. x-elio.com vs www.x-elio.com).
 */
export function faviconApexFallbackFromWebsite(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    const hostname = u.hostname;
    if (!hostname || hostname === 'localhost') return null;
    if (!/^www\./i.test(hostname)) return null;
    const apex = hostname.slice(4);
    if (!apex) return null;
    return googleFaviconV2Url(`https://${apex}`);
  } catch {
    return null;
  }
}
