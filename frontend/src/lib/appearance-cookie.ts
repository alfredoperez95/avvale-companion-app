export type Appearance = 'microsoft' | 'fiori';

const COOKIE_NAME = 'appearance';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Tema por defecto en toda la aplicación (SAP Fiori). */
export const DEFAULT_APPEARANCE: Appearance = 'fiori';

function parseStoredCookie(value: string | null | undefined): Appearance | null {
  if (!value) return null;
  return value === 'fiori' ? 'fiori' : value === 'microsoft' ? 'microsoft' : null;
}

/**
 * Preferencia efectiva de tema: solo el valor `microsoft` fuerza el estilo Microsoft;
 * `null`, `undefined`, `fiori` u otro valor desconocido → Fiori (por defecto).
 */
export function resolveAppearance(raw: string | null | undefined): Appearance {
  if (raw === 'microsoft') return 'microsoft';
  return 'fiori';
}

export function getAppearanceFromCookie(): Appearance | null {
  if (typeof document === 'undefined') return null;
  const target = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.split('=')[1];
  return parseStoredCookie(target ? decodeURIComponent(target) : null);
}

export function setAppearanceCookie(value: Appearance) {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

export function clearAppearanceCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
