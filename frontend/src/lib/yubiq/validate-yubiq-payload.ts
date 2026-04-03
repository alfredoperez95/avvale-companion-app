import {
  YUBIQ_PAYLOAD_SCHEMA_VERSION,
  YUBIQ_TARGETS,
  type YubiqChromePayload,
  type YubiqTargetId,
} from '@/types/yubiq-payload';
import { ALLOWED_YUBIQ_SEGMENTS } from './normalize-segment';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_SEGMENT = new Set<string>(ALLOWED_YUBIQ_SEGMENTS);

export type ValidateYubiqPayloadResult = {
  isValid: boolean;
  errors: string[];
};

/**
 * Validación mínima del payload antes de entregarlo a la extensión.
 */
export function validateYubiqPayload(payload: YubiqChromePayload): ValidateYubiqPayloadResult {
  const errors: string[] = [];

  if (payload.schemaVersion !== YUBIQ_PAYLOAD_SCHEMA_VERSION) {
    errors.push('invalid_schemaVersion');
  }

  const target = payload.target as YubiqTargetId;
  if (!YUBIQ_TARGETS[target]) {
    errors.push('unknown_target');
  } else if (payload.targetUrl !== YUBIQ_TARGETS[target].targetUrl) {
    errors.push('targetUrl_mismatch');
  }

  if (!payload.generatedAt || Number.isNaN(Date.parse(payload.generatedAt))) {
    errors.push('invalid_generatedAt');
  }

  if (payload.prefill.documentType !== 'offer') {
    errors.push('invalid_documentType');
  }

  if (payload.prefill.company !== 'espana') {
    errors.push('invalid_company');
  }

  if (!YMD.test(payload.prefill.toBeSigned)) {
    errors.push('invalid_toBeSigned');
  }

  const seg = payload.prefill.segment;
  if (seg !== '' && !ALLOWED_SEGMENT.has(seg)) {
    errors.push('invalid_segment');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
