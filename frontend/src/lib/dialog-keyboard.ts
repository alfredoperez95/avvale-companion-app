/**
 * Si el foco está en un control que ya maneja Enter (o no debe ser sustituido por la acción
 * principal del diálogo), no interceptar la tecla.
 */
export function isDialogEnterTargetInteractive(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  const hit = el.closest(
    'button, a[href], input, textarea, select, label, [role="link"], [role="button"], [contenteditable="true"]',
  );
  return Boolean(hit);
}
