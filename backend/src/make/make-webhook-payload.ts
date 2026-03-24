/**
 * Contrato del cuerpo JSON enviado al webhook personalizado de Make (schema v3).
 * v3: añade emailSignature (HTML de la firma global de configuración).
 */

import { formatActivationCode } from '../activations/activation-code';

export const MAKE_WEBHOOK_SCHEMA_VERSION = 3 as const;

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
  /** Lista estructurada de destinatarios To para módulos de email en Make. */
  toRecipients: MakeWebhookRecipientV1[];
  /** Lista de destinatarios Cc en formato array (recomendado para Make/Outlook). */
  recipientCc: string[];
  /** String CSV legacy mantenido por compatibilidad hacia Make. */
  recipientCcCsv: string | null;
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

function parseStoredJsonArray(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
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

  let attachmentList: MakeWebhookAttachmentV1[] = activation.attachments.map((a) => ({
    url: a.publicToken
      ? `${options.attachmentsBaseUrl}/public/attachments/${a.publicToken}`
      : `${options.attachmentsBaseUrl}/activations/${activation.id}/attachments/${a.id}`,
    fileName: a.fileName,
  }));
  if (attachmentList.length === 0) {
    const urls = parseStoredJsonArray(activation.attachmentUrls);
    const names = parseStoredJsonArray(activation.attachmentNames);
    attachmentList = urls.map((url, i) => ({
      url,
      fileName: (names[i] ?? url).trim() || url,
    }));
  }

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
    subject: activation.subject,
    body: activation.body,
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
  };
}
