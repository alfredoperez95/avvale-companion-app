import type { Activation } from '@/types/activation';
import { parseAttachmentUrls } from './activation-attachment-urls';

export function shouldWarnScannedUrlsOnly(activation: Activation): boolean {
  const urls = parseAttachmentUrls(activation.attachmentUrls);
  const hasScannedUrls = urls.length > 0;
  const hasUploadedAttachments = (activation.attachments?.length ?? 0) > 0;
  return hasScannedUrls && !hasUploadedAttachments;
}

