type DebugPayload = {
  stage: 'buildYubiqPayload';
  warnings: string[];
  isValid: boolean;
  validationErrors: string[];
  target?: string;
};

/**
 * En desarrollo: siempre un resumen en `console.debug`.
 * En producción: solo si hay warnings o la validación falla (evita ruido).
 */
export function debugYubiqPayloadBuild(data: DebugPayload): void {
  if (typeof console === 'undefined' || !console.debug) return;

  const isDev = process.env.NODE_ENV === 'development';
  const hasIssues =
    data.warnings.length > 0 || !data.isValid || data.validationErrors.length > 0;
  if (!isDev && !hasIssues) return;

  console.debug('[yubiq-payload]', {
    stage: data.stage,
    target: data.target,
    warnings: data.warnings,
    isValid: data.isValid,
    validationErrors: data.validationErrors,
  });
}
