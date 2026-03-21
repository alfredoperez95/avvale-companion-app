/** Código visible estable derivado del número secuencial (no persistido). */
export function formatActivationCode(activationNumber: number): string {
  return `ACT-${String(activationNumber).padStart(6, '0')}`;
}
