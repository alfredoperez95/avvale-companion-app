/**
 * Contrato del cuerpo JSON enviado al webhook personalizado de Make (schema v2).
 * Versionar con schemaVersion si cambian campos obligatorios.
 */

import { formatActivationCode } from '../activations/activation-code';

export const MAKE_WEBHOOK_SCHEMA_VERSION = 2 as const;

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

export interface MakeWebhookPayloadV1 {
  schemaVersion: typeof MAKE_WEBHOOK_SCHEMA_VERSION;
  activationId: string;
  activationNumber: number;
  activationCode: string;
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
  attachments: { originalUrl: string; fileName: string }[];
  createdByUser: { name: string | null; lastName: string | null; email: string };
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

export function buildMakeWebhookPayload(activation: ActivationForMakePayload): MakeWebhookPayloadV1 {
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
    url: a.originalUrl,
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
    recipientTo: activation.recipientTo,
    recipientCc: activation.recipientCc,
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
