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

/** Misma regla que el backend: URLs de HubSpot no se descargan en servidor sin sesión. */
export function isHubSpotAttachmentUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'app.hubspot.com' || u.hostname.endsWith('.hubspot.com');
  } catch {
    return false;
  }
}

