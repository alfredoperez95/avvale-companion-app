export { buildPrefillTitle } from './build-prefill-title';
export { buildYubiqPayload } from './build-yubiq-payload';
export {
  dispatchYubiqToExtension,
  dispatchYubiqToExtensionAndWait,
  onYubiqExtensionResult,
  YUBIQ_EXTENSION_EVENT_RESULT,
  YUBIQ_EXTENSION_EVENT_START,
} from './companion-app-dispatch';
export type { YubiqExtensionResultDetail } from './companion-app-dispatch';
export { debugYubiqPayloadBuild } from './debug-yubiq-payload';
export { parseAmountAndCurrency } from './normalize-revenue';
export { ALLOWED_YUBIQ_SEGMENTS, normalizeSegment } from './normalize-segment';
export { validateYubiqPayload } from './validate-yubiq-payload';
export type { ValidateYubiqPayloadResult } from './validate-yubiq-payload';

export type {
  BuildYubiqPayloadInput,
  BuildYubiqPayloadResult,
  PrefillReviewFlags,
  YubiqChromePayload,
  YubiqCompanionMeta,
  YubiqDocumentBlock,
  YubiqPrefillBlock,
  YubiqPayloadSchemaVersion,
  YubiqTargetId,
} from '@/types/yubiq-payload';
export { YUBIQ_PAYLOAD_SCHEMA_VERSION, YUBIQ_TARGETS } from '@/types/yubiq-payload';
