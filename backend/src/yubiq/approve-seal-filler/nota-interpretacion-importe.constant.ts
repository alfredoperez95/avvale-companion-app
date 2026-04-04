/** Ver docs/YUBIQ_OFERTA_REGLAS.md (tabla de constantes). */
/**
 * Texto fijo mostrado en el detalle del importe cuando la oferta es solo tarifa T&M
 * sin jornadas indicadas (la app no delega el redactado al modelo).
 */
export const NOTA_INTERPRETACION_IMPORTE_TM_SIN_JORNADAS =
  'No hay dedicación de jornadas indicadas. A efectos de aprobación se interpretará un mínimo de 10.000 € como bolsa de horas.';

/** Importe (€) que se envía a revenue/Yubiq en ese escenario (coherente con la nota). */
export const IMPORTE_MINIMO_BOLSA_HORAS_TM_EUROS = 10_000;
