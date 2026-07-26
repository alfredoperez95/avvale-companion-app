import { probeCompanionExtension } from '@/lib/yubiq/companion-app-dispatch';
import { MAX_CLIENT_ATTACHMENT_BYTES } from '@/lib/attachment-limits';
import {
  AVVALE_EXTENSION_REQUEST_EVENT,
  AVVALE_EXTENSION_RESPONSE_EVENT,
  EXTENSION_BRIDGE_SCHEMA_VERSION,
  MESSAGE_SOURCE_EXTENSION,
  MESSAGE_SOURCE_WEB,
  type ClearTempFilesPayload,
  type DownloadFilesPayload,
  type ExtensionErrorCode,
  type ExtensionOpType,
  type ExtensionRequestDetail,
  type ExtensionResponseDetail,
  type GetTempFilesPayload,
  type GetTempFilesResponseData,
  isExtensionResponseDetail,
  type LocalFileRole,
  type StoreLocalFileDescriptor,
  type StoreLocalFilesPayload,
  type TempFileDescriptor,
} from '@/types/browser-extension-protocol';

export { AVVALE_EXTENSION_REQUEST_EVENT, AVVALE_EXTENSION_RESPONSE_EVENT };

/** Exportados para mostrar en UI «máx. X min» y pruebas. */
export const DOWNLOAD_TIMEOUT_MS = 120_000;
export const GET_CLEAR_TIMEOUT_MS = 30_000;
export const STORE_LOCAL_FILES_TIMEOUT_MS = 30_000;

function bridgeDevLog(message: string, extra?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (extra) {
    console.info(`[AvvaleExtension] ${message}`, extra);
  } else {
    console.info(`[AvvaleExtension] ${message}`);
  }
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateDownloadPayload(payload: DownloadFilesPayload): string | null {
  if (!payload.batchId?.trim()) return 'batchId requerido';
  if (!Array.isArray(payload.items) || payload.items.length === 0) return 'items vacío';
  for (const item of payload.items) {
    if (!item.url?.trim()) return 'URL vacía';
    if (!isSafeHttpUrl(item.url.trim())) return 'Solo se permiten URLs http(s)';
  }
  return null;
}

function validateStoreLocalFilesPayload(payload: StoreLocalFilesPayload): string | null {
  if (!payload.batchId?.trim()) return 'batchId requerido';
  if (!Array.isArray(payload.files) || payload.files.length === 0) return 'files vacío';
  if (payload.files.length > 2) return 'máximo dos archivos';
  const roles = new Set<LocalFileRole>();
  for (const file of payload.files) {
    if (file.role !== 'offer_pdf' && file.role !== 'pfe_excel') return 'role inválido';
    if (roles.has(file.role)) return 'role duplicado';
    roles.add(file.role);
    if (!file.name?.trim()) return 'nombre de archivo requerido';
    if (!file.mimeType?.trim()) return 'mimeType requerido';
    if (!Number.isFinite(file.size) || file.size <= 0) return 'size inválido';
    if (file.size > MAX_CLIENT_ATTACHMENT_BYTES) return 'payload_too_large';
    if (!file.dataBase64?.trim()) return 'dataBase64 requerido';
  }
  if (!roles.has('offer_pdf')) return 'offer_pdf requerido';
  return null;
}

function buildRequest(
  type: ExtensionOpType,
  requestId: string,
  payload: DownloadFilesPayload | GetTempFilesPayload | ClearTempFilesPayload | StoreLocalFilesPayload,
): ExtensionRequestDetail {
  return {
    schemaVersion: EXTENSION_BRIDGE_SCHEMA_VERSION,
    requestId,
    source: MESSAGE_SOURCE_WEB,
    type,
    payload,
  };
}

export function sendExtensionRequest(
  type: ExtensionOpType,
  payload: DownloadFilesPayload | GetTempFilesPayload | ClearTempFilesPayload | StoreLocalFilesPayload,
  timeoutMs: number,
): Promise<ExtensionResponseDetail> {
  if (typeof document === 'undefined') {
    return Promise.resolve({
      schemaVersion: EXTENSION_BRIDGE_SCHEMA_VERSION,
      type,
      requestId: '',
      source: MESSAGE_SOURCE_EXTENSION,
      ok: false,
      error: 'unknown',
    });
  }

  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (detail: ExtensionResponseDetail) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      document.removeEventListener(AVVALE_EXTENSION_RESPONSE_EVENT, onResponse as EventListener);
      resolve(detail);
    };

    const onResponse = (event: Event) => {
      const ce = event as CustomEvent<unknown>;
      const raw = ce.detail;
      if (process.env.NODE_ENV === 'development' && raw && typeof raw === 'object') {
        const r = raw as Record<string, unknown>;
        const rid = r.requestId;
        const matches = rid === requestId;
        bridgeDevLog(matches ? 'evento de respuesta (mismo requestId)' : 'evento de respuesta (otro u otro lote)', {
          esperadoRequestId: requestId.slice(0, 8) + '…',
          recibidoRequestId: typeof rid === 'string' ? rid.slice(0, 8) + '…' : rid,
          type: r.type,
          source: r.source,
          ok: r.ok,
          error: r.error,
        });
      }
      if (!isExtensionResponseDetail(raw)) {
        bridgeDevLog('respuesta ignorada: detail no cumple el contrato (revisa schemaVersion, source, requestId)', {
          tipoDato: typeof raw,
        });
        return;
      }
      if (raw.requestId !== requestId) return;
      if (raw.source !== MESSAGE_SOURCE_EXTENSION) {
        bridgeDevLog('respuesta ignorada: source distinto de avvale-companion-extension', { source: raw.source });
        return;
      }
      if (raw.type !== type) {
        bridgeDevLog('respuesta ignorada: type no coincide con la petición', { esperado: type, recibido: raw.type });
        return;
      }
      bridgeDevLog('respuesta aceptada', { ok: raw.ok, error: raw.error });
      finish(raw);
    };

    const timer = window.setTimeout(() => {
      bridgeDevLog(`timeout tras ${timeoutMs} ms (la extensión no respondió con avvale-extension-response)`, {
        type,
        requestId: requestId.slice(0, 8) + '…',
      });
      finish({
        schemaVersion: EXTENSION_BRIDGE_SCHEMA_VERSION,
        type,
        requestId,
        source: MESSAGE_SOURCE_EXTENSION,
        ok: false,
        error: 'extension_timeout',
      });
    }, timeoutMs);

    document.addEventListener(AVVALE_EXTENSION_RESPONSE_EVENT, onResponse as EventListener);
    const detail = buildRequest(type, requestId, payload);
    bridgeDevLog(`petición → ${AVVALE_EXTENSION_REQUEST_EVENT}`, {
      type,
      requestId,
      schemaVersion: detail.schemaVersion,
      ...(type === 'DOWNLOAD_FILES' && 'items' in detail.payload
        ? {
            batchId: (detail.payload as DownloadFilesPayload).batchId,
            numItems: (detail.payload as DownloadFilesPayload).items.length,
          }
        : type === 'STORE_LOCAL_FILES' && 'files' in detail.payload
          ? {
              batchId: (detail.payload as StoreLocalFilesPayload).batchId,
              numFiles: (detail.payload as StoreLocalFilesPayload).files.length,
            }
        : type === 'GET_TEMP_FILES' || type === 'CLEAR_TEMP_FILES'
          ? { batchId: (detail.payload as { batchId: string }).batchId }
          : {}),
    });
    document.dispatchEvent(
      new CustomEvent(AVVALE_EXTENSION_REQUEST_EVENT, {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  });
}

export function isExtensionAvailable(options?: { timeoutMs?: number }): Promise<boolean> {
  return probeCompanionExtension(options);
}

export type DownloadFilesResult =
  | { ok: true }
  | { ok: false; error: ExtensionErrorCode; timedOut: boolean };

export async function downloadFilesWithExtension(payload: DownloadFilesPayload): Promise<DownloadFilesResult> {
  const err = validateDownloadPayload(payload);
  if (err) {
    return { ok: false, error: 'invalid_payload', timedOut: false };
  }
  const res = await sendExtensionRequest('DOWNLOAD_FILES', payload, DOWNLOAD_TIMEOUT_MS);
  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? 'unknown',
      timedOut: res.error === 'extension_timeout',
    };
  }
  return { ok: true };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function fileToBase64Payload(
  file: File,
  role: LocalFileRole,
): Promise<StoreLocalFileDescriptor> {
  if (file.size > MAX_CLIENT_ATTACHMENT_BYTES) {
    throw new Error('payload_too_large');
  }
  const buffer = await file.arrayBuffer();
  return {
    role,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    dataBase64: arrayBufferToBase64(buffer),
  };
}

export type StoreLocalFilesResult =
  | { ok: true }
  | { ok: false; error: ExtensionErrorCode; timedOut: boolean };

export async function storeLocalFilesInExtension(payload: StoreLocalFilesPayload): Promise<StoreLocalFilesResult> {
  const err = validateStoreLocalFilesPayload(payload);
  if (err) {
    return {
      ok: false,
      error: err === 'payload_too_large' ? 'payload_too_large' : 'invalid_payload',
      timedOut: false,
    };
  }
  const res = await sendExtensionRequest('STORE_LOCAL_FILES', payload, STORE_LOCAL_FILES_TIMEOUT_MS);
  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? 'unknown',
      timedOut: res.error === 'extension_timeout',
    };
  }
  return { ok: true };
}

export type FetchedTempFile = {
  file: File;
  originalUrl?: string;
};

export type FetchTempFilesResult =
  | { ok: true; items: FetchedTempFile[] }
  | { ok: false; error: ExtensionErrorCode; timedOut: boolean };

function decodeBase64ToArrayBuffer(b64: string): ArrayBuffer | null {
  const trimmed = b64.replace(/\s/g, '');
  if (!trimmed) return null;
  try {
    const binary = atob(trimmed);
    const len = binary.length;
    if (len === 0 || len > MAX_CLIENT_ATTACHMENT_BYTES) return null;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}

/**
 * Obtiene bytes del descriptor: prioriza `dataBase64` (fiable en el puente extensión↔página) y copia `arrayBuffer` con `.slice(0)`.
 */
function bytesFromTempDescriptor(d: TempFileDescriptor): ArrayBuffer | null {
  if (typeof d.dataBase64 === 'string' && d.dataBase64.length > 0) {
    const buf = decodeBase64ToArrayBuffer(d.dataBase64);
    if (buf && buf.byteLength > 0) return buf;
  }
  const ab = d.arrayBuffer;
  if (ab instanceof ArrayBuffer && ab.byteLength > 0) {
    if (ab.byteLength > MAX_CLIENT_ATTACHMENT_BYTES) return null;
    return ab.slice(0);
  }
  return null;
}

function descriptorToFile(d: TempFileDescriptor): File | null {
  const buf = bytesFromTempDescriptor(d);
  if (!buf || buf.byteLength === 0) {
    bridgeDevLog('fichero sin bytes (0 B): revisa dataBase64 o arrayBuffer en la extensión; ArrayBuffer en CustomEvent a veces llega vacío', {
      name: d.name,
      tieneDataBase64: typeof d.dataBase64 === 'string' && d.dataBase64.length > 0,
      arrayBufferLen: d.arrayBuffer instanceof ArrayBuffer ? d.arrayBuffer.byteLength : -1,
    });
    return null;
  }
  const safeName = d.name.replace(/[/\\?*:|"<>]/g, '_').slice(0, 200) || 'documento';
  return new File([buf], safeName, {
    type: d.mimeType || 'application/octet-stream',
  });
}

export async function fetchTempFilesFromExtension(batchId: string): Promise<FetchTempFilesResult> {
  const res = await sendExtensionRequest('GET_TEMP_FILES', { batchId }, GET_CLEAR_TIMEOUT_MS);
  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? 'unknown',
      timedOut: res.error === 'extension_timeout',
    };
  }
  const data = res.data as GetTempFilesResponseData | undefined;
  if (!data?.files || !Array.isArray(data.files)) {
    return { ok: false, error: 'invalid_payload', timedOut: false };
  }
  const items: FetchedTempFile[] = [];
  for (const f of data.files) {
    const file = descriptorToFile(f);
    if (!file) {
      return { ok: false, error: 'invalid_payload', timedOut: false };
    }
    items.push({ file, originalUrl: f.originalUrl });
  }
  return { ok: true, items };
}

export type ClearTempFilesResult =
  | { ok: true }
  | { ok: false; error: ExtensionErrorCode; timedOut: boolean };

export async function clearTempFilesInExtension(batchId: string): Promise<ClearTempFilesResult> {
  const res = await sendExtensionRequest('CLEAR_TEMP_FILES', { batchId }, GET_CLEAR_TIMEOUT_MS);
  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? 'unknown',
      timedOut: res.error === 'extension_timeout',
    };
  }
  return { ok: true };
}
