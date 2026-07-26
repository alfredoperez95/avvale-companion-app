export { buildPrefillTitle } from './build-prefill-title';
export { buildYubiqPayload } from './build-yubiq-payload';
export {
  AVVALE_YUBIQ_AS_EVENT_COLLECT_RESULT,
  AVVALE_YUBIQ_AS_EVENT_OPEN,
  AVVALE_YUBIQ_AS_EVENT_OPEN_RESULT,
  COMPANION_EXTENSION_PING,
  COMPANION_EXTENSION_PONG,
  dispatchYubiqAsOpenToExtension,
  dispatchYubiqAsOpenToExtensionAndWait,
  dispatchYubiqToExtension,
  dispatchYubiqToExtensionAndWait,
  messageForYubiqAsCollectResult,
  messageForYubiqAsOpenResult,
  onYubiqAsCollectResult,
  onYubiqAsOpenResult,
  onYubiqExtensionResult,
  probeCompanionExtension,
  resolveYubiqAsCollectPageUrl,
  resolveYubiqAsCollectResult,
  YUBIQ_AS_COLLECT_BUTTON_ID,
  YUBIQ_AS_COLLECT_BUTTON_LABEL,
  YUBIQ_AS_COLLECT_RESULT_EVENT,
  YUBIQ_EXTENSION_EVENT_RESULT,
  YUBIQ_EXTENSION_EVENT_START,
} from './companion-app-dispatch';
export type {
  YubiqAsCollectResolved,
  YubiqAsCollectResultDetail,
  YubiqAsOpenDetail,
  YubiqAsOpenResultDetail,
  YubiqExtensionResultDetail,
} from './companion-app-dispatch';
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
export { YUBIQ_PAYLOAD_SCHEMA_VERSION, YUBIQ_TARGETS, YUBIQ_AS_HOME_URL } from '@/types/yubiq-payload';
