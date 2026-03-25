/** Textos antiguos guardados en BD / devueltos por versiones anteriores del backend. */
const LEGACY_ERROR_DISPLAY: Record<string, string> = {
  'Timeout esperando confirmación de Make':
    'No hemos recibido respuesta del sistema de automatización a tiempo. Por favor, inténtalo de nuevo en unos segundos.',
};

/**
 * Mensaje de error para mostrar al usuario (metadatos, detalle). No altera el valor en API/BD.
 */
export function displayActivationErrorMessage(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  return LEGACY_ERROR_DISPLAY[t] ?? t;
}
