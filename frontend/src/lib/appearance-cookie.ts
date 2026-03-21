export type Appearance = 'microsoft' | 'fiori';

const COOKIE_NAME = 'appearance';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function normalizeAppearance(value: string | null | undefined): Appearance | null {
  if (!value) return null;
  return value === 'fiori' ? 'fiori' : value === 'microsoft' ? 'microsoft' : null;
}

export function getAppearanceFromCookie(): Appearance | null {
  if (typeof document === 'undefined') return null;
  const target = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.split('=')[1];
  return normalizeAppearance(target ? decodeURIComponent(target) : null);
}

export function setAppearanceCookie(value: Appearance) {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

export function clearAppearanceCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
