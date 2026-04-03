import type { ClaudeOfferExtraction } from './yubiq';

/** Versión del contrato JSON consumido por la extensión Chrome. */
export type YubiqPayloadSchemaVersion = '1.0.0';

/** Identificador de destino (extensible a más pantallas Yubiq u otros sistemas). */
export type YubiqTargetId = 'yubiq_addnew';

export type YubiqTargetConfig = {
  targetUrl: string;
};

/** Registro de URLs por target; añadir aquí nuevas entradas en el futuro. */
export const YUBIQ_TARGETS: Record<YubiqTargetId, YubiqTargetConfig> = {
  yubiq_addnew: {
    targetUrl: 'https://avvale-aes-y5ui.yubiq.app/YUBIK/home#addnew',
  },
};

export const YUBIQ_PAYLOAD_SCHEMA_VERSION: YubiqPayloadSchemaVersion = '1.0.0';

export type YubiqDocumentBlock = {
  fileName: string;
  title: string;
  client: string;
  summary: string;
  amount: string;
  currency: string;
  regulatedArea: string;
};

export type YubiqPrefillBlock = {
  title: string;
  description: string;
  toBeSigned: string;
  documentType: 'offer';
  customerName: string;
  company: 'espana';
  segment: string;
  revenue: string;
};

export type PrefillReviewFlags = {
  /** true si el segmento no pudo mapearse a un valor permitido. */
  segment?: boolean;
  /** true si no quedó importe usable tras normalizar. */
  revenue?: boolean;
};

/**
 * Metadatos para depuración y trazabilidad (p. ej. `yubiqAutofillLastResult` en la extensión).
 * No se usan para rellenar el formulario; `target` / `prefill` son el contrato de automatización.
 */
export type YubiqCompanionMeta = {
  schemaVersion: YubiqPayloadSchemaVersion;
  generatedAt: string;
  isValid: boolean;
  validationErrors: string[];
  warnings: string[];
  prefillReview?: PrefillReviewFlags;
  /** Copia de `document` para contexto cuando se inspecciona el JSON fuera de la app. */
  document: YubiqDocumentBlock;
};

export type YubiqChromePayload = {
  schemaVersion: YubiqPayloadSchemaVersion;
  target: YubiqTargetId;
  targetUrl: string;
  generatedAt: string;
  document: YubiqDocumentBlock;
  prefill: YubiqPrefillBlock;
  /** Opcional: la extensión Chrome lo conserva para logs/storage; la automatización del formulario ignora estos campos. */
  companionMeta?: YubiqCompanionMeta;
};

export type BuildYubiqPayloadInput = {
  extraction: ClaudeOfferExtraction;
  fileName: string;
  target?: YubiqTargetId;
  /** Para tests; por defecto `new Date()`. */
  now?: Date;
  /** Si true, emite `console.debug` aunque no haya warnings (solo en desarrollo). */
  verboseDebug?: boolean;
  /**
   * Si `false`, el JSON no incluye `companionMeta` (solo contrato mínimo para pruebas).
   * Por defecto `true`: mismo objeto que acepta la extensión con contexto de validación.
   */
  includeCompanionMeta?: boolean;
};

export type BuildYubiqPayloadResult = {
  payload: YubiqChromePayload;
  warnings: string[];
  isValid: boolean;
  validationErrors: string[];
  prefillReview?: PrefillReviewFlags;
};
