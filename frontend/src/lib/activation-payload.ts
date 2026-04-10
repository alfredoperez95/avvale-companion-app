/**
 * Payload que la extensión Chrome envía en el hash de la URL al abrir /activations/new
 */
export interface ActivationPayloadFromExtension {
  projectName?: string;
  offerCode?: string;
  hubspotUrl?: string;
  client?: string;
  amount?: string;
  projectManagerEmail?: string;
  /**
   * Desde HubSpot / extensión. Valores conocidos:
   * - "Consulting" → CONSULTORIA
   * - "Software" | "Software / Product" → SW
   */
  serviceType?: string;
  attachmentUrls?: string[];
  /** Nombres de archivo (mismo orden que attachmentUrls); puede ser string vacío si no hay nombre */
  attachmentNames?: string[];
}

/**
 * Mapea `serviceType` del hash de la extensión al tipo de oportunidad del formulario.
 */
export function mapExtensionServiceTypeToProjectType(
  serviceType: string | undefined | null,
): '' | 'CONSULTORIA' | 'SW' {
  const s = (serviceType ?? '').trim().replace(/\s+/g, ' ');
  if (s === 'Consulting') return 'CONSULTORIA';
  if (s === 'Software' || s === 'Software / Product') return 'SW';
  return '';
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
