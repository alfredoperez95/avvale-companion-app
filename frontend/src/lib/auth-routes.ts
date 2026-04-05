/**
 * Rutas canónicas de autenticación.
 * @see docs/LOGIN_STANDARD.md — el inicio de sesión es la única entrada no autenticada; no duplicar rutas sueltas.
 */
export const LOGIN_PATH = '/login' as const;

/** Canje de token del correo (query `token`). */
export const LOGIN_MAGIC_PATH = '/login/magic' as const;

/** Redirección dura al flujo de inicio de sesión (misma URL en toda la app). */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  window.location.href = LOGIN_PATH;
}
