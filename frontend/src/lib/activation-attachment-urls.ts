export function parseAttachmentUrls(attachmentUrls: string | null): string[] {
  if (!attachmentUrls) return [];
  try {
    const parsed = JSON.parse(attachmentUrls);
    return Array.isArray(parsed) ? parsed : [attachmentUrls];
  } catch {
    return attachmentUrls.split(/[\n,]/).map((u) => u.trim()).filter(Boolean);
  }
}

export function parseAttachmentNames(attachmentNames: string | null): string[] {
  if (!attachmentNames) return [];
  try {
    const parsed = JSON.parse(attachmentNames);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

