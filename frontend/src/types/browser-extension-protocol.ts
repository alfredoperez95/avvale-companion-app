/**
 * Contrato de mensajería entre la web (Companion) y la extensión Avvale Companion.
 * Transporte: CustomEvent en `document` — ver docs/BROWSER_EXTENSION_BRIDGE.md
 */

export const EXTENSION_BRIDGE_SCHEMA_VERSION = 1 as const;

export const AVVALE_EXTENSION_REQUEST_EVENT = 'avvale-extension-request' as const;
export const AVVALE_EXTENSION_RESPONSE_EVENT = 'avvale-extension-response' as const;

export const MESSAGE_SOURCE_WEB = 'avvale-companion-web' as const;
export const MESSAGE_SOURCE_EXTENSION = 'avvale-companion-extension' as const;

export type ExtensionOpType = 'DOWNLOAD_FILES' | 'GET_TEMP_FILES' | 'CLEAR_TEMP_FILES';

/** Códigos de error estables para la extensión y el cliente web. */
export type ExtensionErrorCode =
  | 'extension_timeout'
  | 'invalid_payload'
  | 'download_failed'
  | 'batch_not_found'
  | 'unknown';

export type DownloadFileItem = {
  url: string;
  suggestedName?: string;
};

export type DownloadFilesPayload = {
  batchId: string;
  items: DownloadFileItem[];
};

export type GetTempFilesPayload = {
  batchId: string;
};

export type ClearTempFilesPayload = {
  batchId: string;
};

export type ExtensionRequestDetail = {
  schemaVersion: typeof EXTENSION_BRIDGE_SCHEMA_VERSION;
  requestId: string;
  source: typeof MESSAGE_SOURCE_WEB;
  type: ExtensionOpType;
  payload: DownloadFilesPayload | GetTempFilesPayload | ClearTempFilesPayload;
};

/**
 * Uno de `dataBase64` o `arrayBuffer` (no vacío) debe aportar el binario.
 * En extensiones Chrome, `ArrayBuffer` en `CustomEvent.detail` a veces llega vacío al cruzar
 * content script ↔ página; conviene enviar **dataBase64** (o copiar con `.slice(0)` antes de despachar).
 */
export type TempFileDescriptor = {
  originalUrl?: string;
  name: string;
  mimeType: string;
  arrayBuffer?: ArrayBuffer;
  /** Contenido del fichero en base64 (sin prefijo `data:...;base64,`). Más fiable que solo arrayBuffer en el puente. */
  dataBase64?: string;
};

export type GetTempFilesResponseData = {
  files: TempFileDescriptor[];
};

export type ExtensionResponseDetail = {
  schemaVersion: number;
  type: ExtensionOpType;
  requestId: string;
  source: typeof MESSAGE_SOURCE_EXTENSION;
  ok: boolean;
  error?: ExtensionErrorCode;
  data?: unknown;
};

export function isExtensionResponseDetail(x: unknown): x is ExtensionResponseDetail {
  if (x === null || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    o.source === MESSAGE_SOURCE_EXTENSION &&
    typeof o.requestId === 'string' &&
    typeof o.schemaVersion === 'number' &&
    typeof o.ok === 'boolean' &&
    typeof o.type === 'string'
  );
}
