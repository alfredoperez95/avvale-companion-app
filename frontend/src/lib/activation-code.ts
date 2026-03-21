/** Misma regla que en backend/src/activations/activation-code.ts */
export function formatActivationCode(activationNumber: number): string {
  return `ACT-${String(activationNumber).padStart(6, '0')}`;
}
