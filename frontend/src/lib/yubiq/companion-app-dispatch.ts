import type { YubiqChromePayload } from '@/types/yubiq-payload';

/** Dispara el mismo flujo que el popup de la extensión (content script en la página Companion). */
export const YUBIQ_EXTENSION_EVENT_START = 'avvale-companion-yubiq-start' as const;

/** La extensión responde cuando el pipeline termina o falla (opcional). */
export const YUBIQ_EXTENSION_EVENT_RESULT = 'avvale-companion-yubiq-result' as const;

export type YubiqExtensionResultDetail = {
  ok: boolean;
  tabId?: number;
  error?: string;
};

/**
 * Emite el evento que escucha `companion-yubiq-bridge.js` en la extensión.
 * La web no puede usar `chrome.runtime`; el content script reenvía al service worker.
 */
export function dispatchYubiqToExtension(payload: YubiqChromePayload): void {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent(YUBIQ_EXTENSION_EVENT_START, {
      bubbles: true,
      detail: { payload },
    }),
  );
}

/**
 * Suscripción a la respuesta de la extensión. Devuelve función para desuscribirse.
 */
export function onYubiqExtensionResult(
  handler: (detail: YubiqExtensionResultDetail) => void,
  opts?: { once?: boolean },
): () => void {
  const listener = (e: Event) => {
    const ce = e as CustomEvent<YubiqExtensionResultDetail>;
    handler(ce.detail ?? { ok: false, error: 'missing_detail' });
  };
  document.addEventListener(YUBIQ_EXTENSION_EVENT_RESULT, listener as EventListener, { once: opts?.once ?? false });
  return () => document.removeEventListener(YUBIQ_EXTENSION_EVENT_RESULT, listener as EventListener);
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Envía el payload y espera `avvale-companion-yubiq-result` o timeout si no hay extensión.
 */
export function dispatchYubiqToExtensionAndWait(
  payload: YubiqChromePayload,
  options?: { timeoutMs?: number },
): Promise<YubiqExtensionResultDetail> {
  if (typeof document === 'undefined') {
    return Promise.resolve({ ok: false, error: 'no_document' });
  }
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (detail: YubiqExtensionResultDetail) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      off();
      resolve(detail);
    };

    const timer = window.setTimeout(() => {
      finish({ ok: false, error: 'extension_timeout' });
    }, timeoutMs);

    const off = onYubiqExtensionResult((detail) => finish(detail), { once: true });
    dispatchYubiqToExtension(payload);
  });
}
