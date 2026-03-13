/**
 * Payload que la extensión Chrome envía en el hash de la URL al abrir /activations/new
 */
export interface ActivationPayloadFromExtension {
  projectName?: string;
  offerCode?: string;
  hubspotUrl?: string;
  client?: string;
  amount?: string;
  /** "Consulting" | "Software" (desde HubSpot) → se mapea a CONSULTORIA | SW */
  serviceType?: string;
  attachmentUrls?: string[];
}

/**
 * Lee y decodifica el payload en base64url desde window.location.hash.
 * Devuelve el objeto parseado o null si no hay hash o hay error.
 */
export function getActivationPayloadFromHash(): ActivationPayloadFromExtension | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  try {
    let base64 = hash.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '===='.slice(0, 4 - pad);
    const json = decodeURIComponent(escape(atob(base64)));
    return JSON.parse(json) as ActivationPayloadFromExtension;
  } catch {
    return null;
  }
}
