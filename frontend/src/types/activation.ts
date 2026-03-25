export type ActivationStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'PROCESSING'
  | 'RETRYING'
  | 'PENDING_CALLBACK'
  | 'SENT'
  | 'FAILED';

/** Estados en los que el envío a Make/cola puede completarse; conviene refrescar la lista periódicamente. */
export const ACTIVATION_IN_FLIGHT_STATUSES: ActivationStatus[] = [
  'QUEUED',
  'PROCESSING',
  'RETRYING',
  'PENDING_CALLBACK',
];

export interface Activation {
  id: string;
  /** Secuencial único (humano / Make / logs). */
  activationNumber: number;
  status: ActivationStatus;
  projectName: string;
  client: string | null;
  offerCode: string;
  projectAmount: string | null;
  projectType: 'CONSULTORIA' | 'SW' | null;
  hubspotUrl: string | null;
  body: string | null;
  attachmentUrls: string | null;
  attachmentNames: string | null;
  recipientTo: string;
  recipientCc: string | null;
  subject: string;
  createdAt: string;
  createdBy: string;
  createdByUserId?: string;
  createdByUser?: { name: string | null; lastName: string | null; email: string } | null;
  makeSentAt: string | null;
  makeRunId: string | null;
  errorMessage: string | null;
  activationAreas?: { area: { id: string; name: string } }[];
  activationSubAreas?: { subArea: { id: string; name: string; area: { id: string; name: string } } }[];
  attachments?: { id: string; fileName: string; originalUrl: string; contentType: string | null; createdAt: string }[];
}
