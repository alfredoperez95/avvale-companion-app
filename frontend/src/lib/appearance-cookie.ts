export type Appearance = 'microsoft' | 'fiori';

const LEGACY_COOKIE_NAME = 'appearance';
const STORAGE_KEY = 'appearance';

/** Tema por defecto en toda la aplicación (SAP Fiori). */
export const DEFAULT_APPEARANCE: Appearance = 'fiori';

function parseStoredAppearance(value: string | null | undefined): Appearance | null {
  if (!value) return null;
  return value === 'fiori' ? 'fiori' : value === 'microsoft' ? 'microsoft' : null;
}

function clearLegacyAppearanceCookie() {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  document.cookie = `${LEGACY_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${secure}`;
}

/**
 * Preferencia efectiva de tema: solo el valor `microsoft` fuerza el estilo Microsoft;
 * `null`, `undefined`, `fiori` u otro valor desconocido → Fiori (por defecto).
 */
export function resolveAppearance(raw: string | null | undefined): Appearance {
  if (raw === 'microsoft') return 'microsoft';
  return 'fiori';
}

export function getStoredAppearance(): Appearance | null {
  if (typeof window === 'undefined') return null;
  clearLegacyAppearanceCookie();
  try {
    return parseStoredAppearance(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function setStoredAppearance(value: Appearance) {
  if (typeof window === 'undefined') return;
  clearLegacyAppearanceCookie();
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearStoredAppearance() {
  if (typeof window === 'undefined') return;
  clearLegacyAppearanceCookie();
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export const getAppearanceFromCookie = getStoredAppearance;
export const setAppearanceCookie = setStoredAppearance;
export const clearAppearanceCookie = clearStoredAppearance;
