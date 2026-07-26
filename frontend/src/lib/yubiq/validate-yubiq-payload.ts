import {
  YUBIQ_PAYLOAD_SCHEMA_VERSION,
  YUBIQ_TARGETS,
  type YubiqChromePayload,
  type YubiqTargetId,
} from '@/types/yubiq-payload';
import { ALLOWED_YUBIQ_SEGMENTS } from './normalize-segment';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_SEGMENT = new Set<string>(ALLOWED_YUBIQ_SEGMENTS);
const ALLOWED_EXTENSION_FILE_ROLES = new Set(['offer_pdf', 'pfe_excel']);

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

  if (payload.manualMargin !== undefined) {
    const m = payload.manualMargin;
    if (typeof m !== 'number' || !Number.isFinite(m) || !Number.isInteger(m) || m < 0 || m > 100) {
      errors.push('invalid_manualMargin');
    }
  }

  if (payload.extensionFiles !== undefined) {
    const ext = payload.extensionFiles;
    if (!ext.batchId?.trim()) {
      errors.push('invalid_extensionFiles_batchId');
    }
    if (!Array.isArray(ext.files) || ext.files.length === 0 || ext.files.length > 2) {
      errors.push('invalid_extensionFiles_files');
    } else {
      const roles = new Set<string>();
      for (const file of ext.files) {
        if (!ALLOWED_EXTENSION_FILE_ROLES.has(file.role)) {
          errors.push('invalid_extensionFiles_role');
        }
        if (roles.has(file.role)) {
          errors.push('duplicate_extensionFiles_role');
        }
        roles.add(file.role);
        if (!file.name?.trim() || !file.mimeType?.trim()) {
          errors.push('invalid_extensionFiles_fileMeta');
        }
        if (!Number.isFinite(file.size) || file.size <= 0) {
          errors.push('invalid_extensionFiles_size');
        }
      }
      if (!roles.has('offer_pdf')) {
        errors.push('missing_extensionFiles_offer_pdf');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
