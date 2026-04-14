/**
 * Descarga una URL en memoria (Blob → File) para subirla al servidor.
 * Solo funciona si el origen permite CORS; dominios como HubSpot suelen bloquear la lectura desde otra web.
 */

import { MAX_CLIENT_ATTACHMENT_BYTES } from '@/lib/attachment-limits';

const MAX_BYTES = MAX_CLIENT_ATTACHMENT_BYTES;

function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const m =
    header.match(/filename\*=(?:UTF-8'')?([^;\s]+)/i) ?? header.match(/filename=["']?([^"'\s;]+)["']?/i);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1].trim());
  } catch {
    return m[1].trim();
  }
}

function basenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (last?.includes('.')) return last.split('?')[0] ?? 'documento';
  } catch {
    // ignore
  }
  return 'documento';
}

export type FetchUrlAsFileResult =
  | { ok: true; file: File }
  | { ok: false; error: string };

/**
 * Intenta obtener el recurso como File (nombre inferido por cabeceras o URL).
 */
export async function fetchUrlAsFileInBrowser(url: string, displayName: string): Promise<FetchUrlAsFileResult> {
  try {
    const res = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const len = res.headers.get('content-length');
    if (len) {
      const n = Number.parseInt(len, 10);
      if (Number.isFinite(n) && n > MAX_BYTES) {
        return { ok: false, error: `Archivo demasiado grande (máx. ${MAX_BYTES / 1024 / 1024} MB)` };
      }
    }
    const blob = await res.blob();
    if (blob.size > MAX_BYTES) {
      return { ok: false, error: `Archivo demasiado grande (máx. ${MAX_BYTES / 1024 / 1024} MB)` };
    }
    const fromCd = parseFilenameFromContentDisposition(res.headers.get('content-disposition'));
    let fileName = fromCd || displayName.trim() || basenameFromUrl(url);
    if (!fileName.includes('.')) {
      const mime = blob.type?.split(';')[0]?.trim().toLowerCase();
      const extMap: Record<string, string> = {
        'application/pdf': '.pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/msword': '.doc',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
      };
      const ext = mime ? extMap[mime] ?? (mime.startsWith('image/') ? `.${mime.split('/')[1]?.split('+')[0] || 'img'}` : '') : '';
      if (ext) fileName = `${fileName}${ext}`;
    }
    const safeName = fileName.replace(/[/\\?*:|"<>]/g, '_').slice(0, 200) || 'documento';
    const file = new File([blob], safeName, { type: blob.type || 'application/octet-stream' });
    return { ok: true, file };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Failed to fetch|NetworkError|Load failed|CORS/i.test(msg)) {
      return {
        ok: false,
        error:
          'No se pudo leer la URL desde esta página (CORS o red). Es habitual en HubSpot: descarga manual o usa «Importar al servidor» si el enlace es público.',
      };
    }
    return { ok: false, error: msg };
  }
}
