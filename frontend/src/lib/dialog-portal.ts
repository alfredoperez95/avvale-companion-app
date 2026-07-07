export const APP_SHELL_BODY_ID = 'app-shell-body';
export const APP_MAIN_FOOTER_WRAP_ID = 'app-main-footer-wrap';

const OVERLAY_VAR_TOP = '--dialog-overlay-top';
const OVERLAY_VAR_LEFT = '--dialog-overlay-left';
const OVERLAY_VAR_WIDTH = '--dialog-overlay-width';
const OVERLAY_VAR_HEIGHT = '--dialog-overlay-height';

/** Contenedor del overlay modal dentro del shell (evita recorte por transforms del contenido). */
export function resolveDialogPortalHost(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return (
    document.getElementById(APP_SHELL_BODY_ID) ??
    document.getElementById(APP_MAIN_FOOTER_WRAP_ID) ??
    document.body
  );
}

export function isScopedDialogPortalHost(host: HTMLElement | null): boolean {
  if (!host) return false;
  return host.id === APP_SHELL_BODY_ID || host.id === APP_MAIN_FOOTER_WRAP_ID;
}

export function lockDialogScroll(host: HTMLElement): () => void {
  const previousOverflow = host.style.overflow;
  const previousOverflowY = host.style.overflowY;
  const previousScrollTop = host.scrollTop;
  host.setAttribute('data-confirm-dialog-open', 'true');
  host.scrollTop = 0;
  host.style.overflow = 'hidden';
  host.style.overflowY = 'hidden';
  return () => {
    host.style.overflow = previousOverflow;
    host.style.overflowY = previousOverflowY;
    host.scrollTop = previousScrollTop;
    host.removeAttribute('data-confirm-dialog-open');
  };
}

/** Fija el overlay al rect visible del host (position:fixed), independiente del scroll interno. */
export function syncDialogOverlayBounds(host: HTMLElement): () => void {
  const root = document.documentElement;

  const apply = () => {
    const rect = host.getBoundingClientRect();
    root.style.setProperty(OVERLAY_VAR_TOP, `${rect.top}px`);
    root.style.setProperty(OVERLAY_VAR_LEFT, `${rect.left}px`);
    root.style.setProperty(OVERLAY_VAR_WIDTH, `${rect.width}px`);
    root.style.setProperty(OVERLAY_VAR_HEIGHT, `${rect.height}px`);
  };

  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('scroll', apply, true);

  return () => {
    window.removeEventListener('resize', apply);
    window.removeEventListener('scroll', apply, true);
    root.style.removeProperty(OVERLAY_VAR_TOP);
    root.style.removeProperty(OVERLAY_VAR_LEFT);
    root.style.removeProperty(OVERLAY_VAR_WIDTH);
    root.style.removeProperty(OVERLAY_VAR_HEIGHT);
  };
}
