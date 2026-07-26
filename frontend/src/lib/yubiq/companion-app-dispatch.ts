import type { YubiqChromePayload } from '@/types/yubiq-payload';
import { YUBIQ_AS_HOME_URL } from '@/types/yubiq-payload';

/** Dispara el mismo flujo que el popup de la extensión (content script en la página Companion). */
export const YUBIQ_EXTENSION_EVENT_START = 'avvale-companion-yubiq-start' as const;

/** La extensión responde cuando el pipeline termina o falla (opcional). */
export const YUBIQ_EXTENSION_EVENT_RESULT = 'avvale-companion-yubiq-result' as const;

/**
 * Ping/Pong para saber si el content script de Avvale Companion está inyectado en esta pestaña.
 * La web no puede usar `chrome.runtime`; el content script debe escuchar el ping y emitir el pong.
 *
 * En la extensión (content script), añadir:
 * ```js
 * document.addEventListener('avvale-companion-ping', () => {
 *   document.dispatchEvent(new CustomEvent('avvale-companion-pong', { bubbles: true, composed: true }));
 * });
 * ```
 */
export const COMPANION_EXTENSION_PING = 'avvale-companion-ping' as const;
export const COMPANION_EXTENSION_PONG = 'avvale-companion-pong' as const;

/**
 * Abrir home de Yubiq Approve & Seal vía extensión (botón «Explorar» en activaciones).
 * NO confundir con prefill (`YUBIQ_EXTENSION_EVENT_START` → #addnew).
 */
export const AVVALE_YUBIQ_AS_EVENT_OPEN = 'avvale-companion-yubiq-as-open' as const;
export const AVVALE_YUBIQ_AS_EVENT_OPEN_RESULT = 'avvale-companion-yubiq-as-open-result' as const;

/**
 * Content script en `https://avvale-aes-y5ui.yubiq.app/*`:
 * inyectar un botón visible con este id y texto «Recopilar información».
 * Al hacer clic: recopilar `location.href` (o URL estable del documento), enviar RESULT a Companion y cerrar la pestaña Yubiq.
 */
export const YUBIQ_AS_COLLECT_BUTTON_ID = 'avvale-companion-yubiq-as-collect' as const;
export const YUBIQ_AS_COLLECT_BUTTON_LABEL = 'Recopilar información' as const;

/**
 * Extensión → Companion: datos recopilados en Approve & Seal.
 * El content script de Companion reemite este CustomEvent en `document`
 * (bubbles + composed). La web rellena `#yubiqAsUrl` y `#yubiqAsId`.
 */
export const AVVALE_YUBIQ_AS_EVENT_COLLECT_RESULT = 'avvale-companion-yubiq-as-collect-result' as const;
/** @deprecated Preferir `AVVALE_YUBIQ_AS_EVENT_COLLECT_RESULT` (mismo valor). */
export const YUBIQ_AS_COLLECT_RESULT_EVENT = AVVALE_YUBIQ_AS_EVENT_COLLECT_RESULT;

export type YubiqAsCollectResultDetail = {
  ok: boolean;
  /**
   * URL a insertar en «Yubiq A&S URL» (`#yubiqAsUrl`).
   * Obligatorio cuando `ok: true` (http/https).
   */
  pageUrl?: string;
  /**
   * Código AES visible en Yubiq (p. ej. `AES0003108` en `span.fw-bold.fs-5.mx-3`).
   * Se inserta en `#yubiqAsId`. Recomendado cuando `ok: true`.
   */
  yubiqAsId?: string;
  error?: string;
  /** Reserva; Companion prioriza `pageUrl` y `yubiqAsId`. */
  data?: Record<string, unknown>;
};

export type YubiqAsOpenDetail = {
  targetUrl?: string;
};

export type YubiqAsOpenResultDetail = {
  ok: boolean;
  tabId?: number;
  error?: string;
};

/**
 * @returns true si la extensión respondió al ping en `timeoutMs`, false si no hay listener o timeout.
 */
export function probeCompanionExtension(options?: { timeoutMs?: number }): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  const timeoutMs = options?.timeoutMs ?? 600;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      document.removeEventListener(COMPANION_EXTENSION_PONG, onPong);
      resolve(ok);
    };
    const onPong = () => finish(true);
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    document.addEventListener(COMPANION_EXTENSION_PONG, onPong);
    document.dispatchEvent(
      new CustomEvent(COMPANION_EXTENSION_PING, { bubbles: true, composed: true }),
    );
  });
}

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
      composed: true,
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
const YUBIQ_AS_OPEN_TIMEOUT_MS = 8000;

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

/**
 * Pide a la extensión abrir Yubiq Approve & Seal (home) en una pestaña con sesión.
 * Por defecto usa `YUBIQ_AS_HOME_URL`.
 */
export function dispatchYubiqAsOpenToExtension(opts?: YubiqAsOpenDetail): void {
  if (typeof document === 'undefined') return;
  const targetUrl = (opts?.targetUrl ?? YUBIQ_AS_HOME_URL).trim() || YUBIQ_AS_HOME_URL;
  document.dispatchEvent(
    new CustomEvent(AVVALE_YUBIQ_AS_EVENT_OPEN, {
      bubbles: true,
      composed: true,
      detail: { targetUrl },
    }),
  );
}

/** Suscripción a `avvale-companion-yubiq-as-open-result`. Devuelve unsubscribe. */
export function onYubiqAsOpenResult(
  handler: (detail: YubiqAsOpenResultDetail) => void,
  opts?: { once?: boolean },
): () => void {
  const listener = (e: Event) => {
    const ce = e as CustomEvent<YubiqAsOpenResultDetail>;
    handler(ce.detail ?? { ok: false, error: 'missing_detail' });
  };
  document.addEventListener(AVVALE_YUBIQ_AS_EVENT_OPEN_RESULT, listener as EventListener, {
    once: opts?.once ?? false,
  });
  return () => document.removeEventListener(AVVALE_YUBIQ_AS_EVENT_OPEN_RESULT, listener as EventListener);
}

/**
 * Dispara OPEN y espera RESULT o timeout (sin extensión / sin respuesta).
 */
export function dispatchYubiqAsOpenToExtensionAndWait(
  opts?: YubiqAsOpenDetail & { timeoutMs?: number },
): Promise<YubiqAsOpenResultDetail> {
  if (typeof document === 'undefined') {
    return Promise.resolve({ ok: false, error: 'no_document' });
  }
  const timeoutMs = opts?.timeoutMs ?? YUBIQ_AS_OPEN_TIMEOUT_MS;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (detail: YubiqAsOpenResultDetail) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      off();
      resolve(detail);
    };

    const timer = window.setTimeout(() => {
      finish({ ok: false, error: 'extension_timeout' });
    }, timeoutMs);

    const off = onYubiqAsOpenResult((detail) => finish(detail), { once: true });
    dispatchYubiqAsOpenToExtension({ targetUrl: opts?.targetUrl });
  });
}

/** Mensaje de UI alineado con el filler de ofertas. */
export function messageForYubiqAsOpenResult(detail: YubiqAsOpenResultDetail): string {
  if (detail.ok) return 'Abriendo Yubiq Approve & Seal…';
  if (detail.error === 'extension_timeout' || detail.error === 'no_document') {
    return 'No se detectó la extensión Avvale Companion. Instálala o actívala en Chrome y recarga esta página.';
  }
  return detail.error?.trim() || 'No se pudo abrir Yubiq Approve & Seal.';
}

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Suscripción a datos recopilados desde Yubiq («Recopilar información»).
 * Devuelve unsubscribe. La extensión emite el evento en Companion y cierra la pestaña Yubiq.
 */
export function onYubiqAsCollectResult(
  handler: (detail: YubiqAsCollectResultDetail) => void,
  opts?: { once?: boolean },
): () => void {
  const listener = (e: Event) => {
    const ce = e as CustomEvent<YubiqAsCollectResultDetail>;
    handler(ce.detail ?? { ok: false, error: 'missing_detail' });
  };
  document.addEventListener(AVVALE_YUBIQ_AS_EVENT_COLLECT_RESULT, listener as EventListener, {
    once: opts?.once ?? false,
  });
  return () => document.removeEventListener(AVVALE_YUBIQ_AS_EVENT_COLLECT_RESULT, listener as EventListener);
}

export type YubiqAsCollectResolved = {
  ok: true;
  pageUrl: string;
  /** Puede ser '' si la extensión no envió ID. */
  yubiqAsId: string;
};

/**
 * Normaliza el RESULT: exige `ok` + `pageUrl` http(s); `yubiqAsId` opcional (trim).
 */
export function resolveYubiqAsCollectResult(detail: YubiqAsCollectResultDetail): YubiqAsCollectResolved | {
  ok: false;
  error: string;
} {
  if (!detail.ok) {
    return { ok: false, error: detail.error?.trim() || 'No se pudo recopilar los datos de Yubiq.' };
  }
  const pageUrl = (detail.pageUrl ?? '').trim();
  if (!pageUrl || !isHttpUrl(pageUrl)) {
    return { ok: false, error: 'La extensión no devolvió una URL válida de Yubiq A&S.' };
  }
  const yubiqAsId = (detail.yubiqAsId ?? '').trim();
  return { ok: true, pageUrl, yubiqAsId };
}

/** @deprecated Usar `resolveYubiqAsCollectResult`. */
export function resolveYubiqAsCollectPageUrl(detail: YubiqAsCollectResultDetail): {
  ok: true;
  pageUrl: string;
} | {
  ok: false;
  error: string;
} {
  const resolved = resolveYubiqAsCollectResult(detail);
  if (!resolved.ok) return resolved;
  return { ok: true, pageUrl: resolved.pageUrl };
}

export function messageForYubiqAsCollectResult(detail: YubiqAsCollectResultDetail): string {
  const resolved = resolveYubiqAsCollectResult(detail);
  if (!resolved.ok) return resolved.error;
  if (resolved.yubiqAsId) return 'URL e ID de Yubiq A&S insertados.';
  return 'URL de Yubiq A&S insertada.';
}
