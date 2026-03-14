export type ActivationStatus = 'DRAFT' | 'READY_TO_SEND' | 'SENT' | 'ERROR';

export interface Activation {
  id: string;
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
  makeSentAt: string | null;
  makeRunId: string | null;
  errorMessage: string | null;
  activationAreas?: { area: { id: string; name: string } }[];
  activationSubAreas?: { subArea: { id: string; name: string; area: { id: string; name: string } } }[];
  attachments?: { id: string; fileName: string; originalUrl: string; contentType: string | null; createdAt: string }[];
}
