export type ActivationStatus = 'DRAFT' | 'READY_TO_SEND' | 'SENT' | 'ERROR';

export interface Activation {
  id: string;
  status: ActivationStatus;
  projectName: string;
  offerCode: string;
  hubspotUrl: string | null;
  body: string | null;
  attachmentUrls: string | null;
  recipientTo: string;
  recipientCc: string | null;
  subject: string;
  templateCode: string;
  createdAt: string;
  createdBy: string;
  makeSentAt: string | null;
  makeRunId: string | null;
  errorMessage: string | null;
}
