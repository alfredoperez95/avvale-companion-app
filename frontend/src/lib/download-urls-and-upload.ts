/**
 * Descarga archivos desde URLs usando la sesión del navegador (p. ej. HubSpot)
 * y los sube como adjuntos de la activación.
 */

const CONTENT_TYPE_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.ms-powerpoint': '.ppt',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/zip': '.zip',
};

function getExtensionFromContentType(contentType: string | null | undefined): string {
  if (!contentType) return '';
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return CONTENT_TYPE_EXT[mime] ?? '';
}

function getFileNameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const match =
    header.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)["']?/i) ??
    header.match(/filename=["']?([^"'\s;]+)["']?/i);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

function suggestFileName(
  contentDisposition: string | null,
  contentType: string | null,
  index: number,
): string {
  const fromDisp = getFileNameFromContentDisposition(contentDisposition);
  if (fromDisp && /\.\w+$/.test(fromDisp)) return fromDisp;
  const ext = getExtensionFromContentType(contentType) || '.bin';
  const base = fromDisp?.replace(/\.[^.]+$/, '') || `documento_${index + 1}`;
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${safe}${ext}`;
}

export type DownloadAndUploadResult = {
  uploaded: number;
  failed: number;
  errors: string[];
};

export type ApiFetchFn = (path: string, init?: RequestInit) => Promise<Response>;

/**
 * Para cada URL: fetch con credentials (sesión del navegador), obtiene el blob
 * y el nombre de archivo, y sube a POST /api/activations/:id/attachments/upload.
 * Si fetch falla (CORS, red, etc.) no se sube y se registra el error.
 */
export async function downloadUrlsAndUploadAttachments(
  activationId: string,
  urls: string[],
  apiFetch: ApiFetchFn,
): Promise<DownloadAndUploadResult> {
  const trimmed = urls.map((u) => u.trim()).filter(Boolean);
  const errors: string[] = [];
  let uploaded = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const url = trimmed[i];
    try {
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        redirect: 'follow',
      });
      if (!res.ok) {
        errors.push(`URL ${i + 1}: HTTP ${res.status}`);
        continue;
      }
      const blob = await res.blob();
      const contentType = res.headers.get('content-type');
      const contentDisposition = res.headers.get('content-disposition');
      const fileName = suggestFileName(contentDisposition, contentType, i);

      const formData = new FormData();
      formData.append('file', blob, fileName);
      formData.append('originalUrl', url);

      const uploadRes = await apiFetch(`/api/activations/${activationId}/attachments/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => ({}));
        errors.push(`URL ${i + 1}: ${(data as { message?: string }).message ?? 'Error al subir'}`);
        continue;
      }
      uploaded++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      errors.push(`URL ${i + 1}: ${msg}`);
    }
  }

  return {
    uploaded,
    failed: errors.length,
    errors,
  };
}
