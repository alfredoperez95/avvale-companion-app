/**
 * Contrato del cuerpo JSON enviado al webhook personalizado de Make (schema v4).
 * v4: toRecipients / ccRecipients como { address } por ítem (validación del módulo Microsoft 365 Email en Make);
 *     añade ccRecipients; v3 añadía emailSignature.
 */

import { formatActivationCode } from '../activations/activation-code';

export const MAKE_WEBHOOK_SCHEMA_VERSION = 4 as const;

export interface MakeWebhookAttachmentV1 {
  url: string;
  fileName: string;
}

export interface MakeWebhookAreaV1 {
  id: string;
  name: string;
}

export interface MakeWebhookSubAreaV1 {
  id: string;
  name: string;
  areaId: string;
  areaName: string;
}

export interface MakeWebhookCreatedByUserV1 {
  name: string | null;
  lastName: string | null;
  email: string;
}

/** Un ítem de toRecipients / ccRecipients: Make Outlook exige el parámetro `address` en la raíz del objeto. */
export interface MakeWebhookRecipientV1 {
  address: string;
}

export interface MakeWebhookPayloadV1 {
  schemaVersion: typeof MAKE_WEBHOOK_SCHEMA_VERSION;
  activationId: string;
  activationNumber: number;
  activationCode: string;
  /** HTML de la firma global; null si no hay firma configurada. */
  emailSignature: string | null;
  /** Lista de destinatarios To en formato array (recomendado para Make/Outlook). */
  recipientTo: string[];
  /** String CSV legacy mantenido por compatibilidad hacia Make. */
  recipientToCsv: string;
  /** Destinatarios To: un objeto `{ address }` por email (mapear a Outlook en Make). */
  toRecipients: MakeWebhookRecipientV1[];
  /** Lista de destinatarios Cc en formato array (recomendado para Make/Outlook). */
  recipientCc: string[];
  /** String CSV legacy mantenido por compatibilidad hacia Make. */
  recipientCcCsv: string | null;
  /** Destinatarios CC: un objeto `{ address }` por email (mapear a Outlook en Make). */
  ccRecipients: MakeWebhookRecipientV1[];
  subject: string;
  body: string | null;
  projectName: string;
  client: string | null;
  offerCode: string;
  projectAmount: string | null;
  projectType: 'CONSULTORIA' | 'SW' | null;
  hubspotUrl: string | null;
  createdBy: string;
  createdByUser: MakeWebhookCreatedByUserV1;
  areas: MakeWebhookAreaV1[];
  subAreas: MakeWebhookSubAreaV1[];
  attachments: MakeWebhookAttachmentV1[];
  /** Indica si el payload incluye adjuntos descargables por Make (archivos reales subidos). */
  hasAttachments?: boolean;
}

/** Tipo mínimo de activación + relaciones necesarias para armar el payload (coincide con findOneByIdAndUser). */
export type ActivationForMakePayload = {
  id: string;
  activationNumber: number;
  recipientTo: string;
  recipientCc: string | null;
  subject: string;
  body: string | null;
  projectName: string;
  client: string | null;
  offerCode: string;
  projectAmount: string | null;
  projectType: 'CONSULTORIA' | 'SW' | null;
  hubspotUrl: string | null;
  createdBy: string;
  attachmentUrls: string | null;
  attachmentNames: string | null;
  activationAreas: { area: { id: string; name: string } }[];
  activationSubAreas: {
    subArea: {
      id: string;
      name: string;
      areaId: string;
      area: { id: string; name: string };
    };
  }[];
  attachments: { id: string; originalUrl: string; fileName: string; publicToken: string | null }[];
  createdByUser: { name: string | null; lastName: string | null; email: string };
};

export type MakeWebhookPayloadOptions = {
  emailSignature: string | null;
  attachmentsBaseUrl: string;
};

/** JSON almacenado en `attachment_urls` / `attachment_names` (arrays serializados). */
function parseStoredJsonStringArray(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function escapeForHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Misma lógica que el frontend (`replaceTemplateVariables`): listado solo si hay URLs en BD
 * y no hay adjuntos reales; enlaces a `attachment_urls` escaneadas.
 */
function buildUrlsEscaneadasHtml(activation: ActivationForMakePayload): string {
  if (activation.attachments.length > 0) return '';
  const urls = parseStoredJsonStringArray(activation.attachmentUrls);
  const names = parseStoredJsonStringArray(activation.attachmentNames);
  const items = urls
    .map((url, i) => ({
      url: url.trim(),
      name: (names[i] ?? '').trim() || url.trim(),
    }))
    .filter((x) => x.url);
  if (items.length === 0) return '';
  const title =
    '<p><strong>URLs escaneadas</strong> (Solo accesibles con Usuario HubSpot)</p>';
  const lis = items
    .map(({ url, name }) => {
      const safeUrl = escapeForHtml(url);
      const label = escapeForHtml(name || url);
      return `<li><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a></li>`;
    })
    .join('');
  return `${title}<ul>${lis}</ul>`;
}

/**
 * Si el marcador `{{urlsEscaneadas}}` ya no está en el HTML pero hay URLs en BD, inserta el
 * bloque en el hueco de la plantilla estándar: entre "Adjunto propuesta…" y "Cualquier cosa comentamos".
 */
function insertFallbackUrlsBlockIntoTemplateSlot(body: string, html: string): string {
  // 1) Tras </p> del párrafo anterior, antes del <p> que abre "Cualquier cosa comentamos"
  const withBetweenParagraphs = body.replace(
    /(<\/p>\s*(?:<br\s*\/?>\s*)*)(<p[^>]*>\s*Cualquier\s+cosa\s+comentamos)/gi,
    (_all, gap, openP) => `${gap}${html}${openP}`,
  );
  if (withBetweenParagraphs !== body) {
    return withBetweenParagraphs;
  }

  // 2) Justo antes del texto "Cualquier cosa comentamos" (p. ej. sin segundo <p> explícito)
  const cualquierMatch = /\bCualquier\s+cosa\s+comentamos\b/i.exec(body);
  if (cualquierMatch && cualquierMatch.index !== undefined) {
    const i = cualquierMatch.index;
    return `${body.slice(0, i)}${html}${body.slice(i)}`;
  }

  // 3) Tras el párrafo que contiene "Adjunto propuesta"
  const afterAdjunto = body.replace(
    /(<p[^>]*>[\s\S]*?Adjunto\s+propuesta[\s\S]*?<\/p>)/i,
    (_all, paragraph) => `${paragraph}${html}`,
  );
  if (afterAdjunto !== body) {
    return afterAdjunto;
  }

  // 4) Último recurso: al final del cuerpo
  const trimmed = body.trimEnd();
  const needsBr = trimmed.length > 0 && !/<br\s*\/?>\s*$/i.test(trimmed);
  return `${trimmed}${needsBr ? '<br>' : ''}${html}`;
}

function injectUrlsEscaneadasInBody(
  body: string | null,
  activation: ActivationForMakePayload,
): string | null {
  if (body == null || body === '') return body;
  const html = buildUrlsEscaneadasHtml(activation);
  // Acepta `{{urlsEscaneadas}}` y variantes con espacios (p. ej. al pegar desde Word).
  let out = body.replace(/\{\{\s*urlsEscaneadas\s*\}\}/gi, () => html);

  if (!html) {
    return out;
  }

  // Si el cuerpo ya contiene el bloque generado (p. ej. guardado desde el frontend), no duplicar.
  if (out.includes(html)) {
    return out;
  }

  // El frontend puede haber sustituido el marcador por vacío cuando aún no había URLs en el
  // formulario; en BD siguen `attachment_urls` — colocar el bloque donde iba el shortcode en la plantilla.
  const markerHtml = '<strong>URLs escaneadas</strong>';
  if (out.includes(markerHtml)) {
    return out;
  }

  return insertFallbackUrlsBlockIntoTemplateSlot(out, html);
}

function splitEmails(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(/[,\n;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildRecipientsList(raw: string | null | undefined): MakeWebhookRecipientV1[] {
  return splitEmails(raw).map((address) => ({ address }));
}

export function buildMakeWebhookPayload(
  activation: ActivationForMakePayload,
  options: MakeWebhookPayloadOptions,
): MakeWebhookPayloadV1 {
  const areas: MakeWebhookAreaV1[] = activation.activationAreas.map((a) => ({
    id: a.area.id,
    name: a.area.name,
  }));
  const subAreas: MakeWebhookSubAreaV1[] = activation.activationSubAreas.map((a) => ({
    id: a.subArea.id,
    name: a.subArea.name,
    areaId: a.subArea.areaId,
    areaName: a.subArea.area.name,
  }));

  // Solo adjuntos reales en BD; las URLs escaneadas van en el cuerpo ({{urlsEscaneadas}}), no como descargas en Make.
  // `attachmentsBaseUrl` viene de resolveBackendPublicBaseUrl: con Next suele ser …/api → …/api/public/attachments/…
  const base = options.attachmentsBaseUrl.trim().replace(/\/+$/, '');
  const attachmentList: MakeWebhookAttachmentV1[] = activation.attachments.map((a) => ({
    url: a.publicToken
      ? `${base}/public/attachments/${a.publicToken}`
      : `${base}/activations/${activation.id}/attachments/${a.id}`,
    fileName: a.fileName,
  }));

  return {
    schemaVersion: MAKE_WEBHOOK_SCHEMA_VERSION,
    activationId: activation.id,
    activationNumber: activation.activationNumber,
    activationCode: formatActivationCode(activation.activationNumber),
    emailSignature: options.emailSignature,
    recipientTo: splitEmails(activation.recipientTo),
    recipientToCsv: activation.recipientTo,
    toRecipients: buildRecipientsList(activation.recipientTo),
    recipientCc: splitEmails(activation.recipientCc),
    recipientCcCsv: activation.recipientCc,
    ccRecipients: buildRecipientsList(activation.recipientCc),
    subject: activation.subject,
    body: injectUrlsEscaneadasInBody(activation.body, activation),
    projectName: activation.projectName,
    client: activation.client,
    offerCode: activation.offerCode,
    projectAmount: activation.projectAmount,
    projectType: activation.projectType,
    hubspotUrl: activation.hubspotUrl,
    createdBy: activation.createdBy,
    createdByUser: {
      name: activation.createdByUser.name,
      lastName: activation.createdByUser.lastName,
      email: activation.createdByUser.email,
    },
    areas,
    subAreas,
    attachments: attachmentList,
    hasAttachments: attachmentList.length > 0,
  };
}
