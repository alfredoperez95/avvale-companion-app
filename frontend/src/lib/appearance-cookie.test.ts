import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearStoredAppearance, getStoredAppearance, setStoredAppearance } from './appearance-cookie';

function installBrowserStorage(protocol = 'https:') {
  const store = new Map<string, string>();
  const cookieWrites: string[] = [];

  vi.stubGlobal('window', {
    location: { protocol },
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
  vi.stubGlobal('document', {
    get cookie() {
      return '';
    },
    set cookie(value: string) {
      cookieWrites.push(value);
    },
  });

  return { store, cookieWrites };
}

describe('appearance storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persiste la apariencia en localStorage, no en una cookie nueva', () => {
    const { store, cookieWrites } = installBrowserStorage();

    setStoredAppearance('microsoft');

    expect(store.get('appearance')).toBe('microsoft');
    expect(getStoredAppearance()).toBe('microsoft');
    expect(cookieWrites.every((value) => value.includes('max-age=0'))).toBe(true);
    expect(cookieWrites.every((value) => value.includes('SameSite=Lax'))).toBe(true);
    expect(cookieWrites.every((value) => value.includes('Secure'))).toBe(true);
    expect(cookieWrites.some((value) => value.includes('microsoft'))).toBe(false);
  });

  it('limpia la preferencia local y la cookie legacy', () => {
    const { store, cookieWrites } = installBrowserStorage();
    store.set('appearance', 'fiori');

    clearStoredAppearance();

    expect(store.has('appearance')).toBe(false);
    expect(cookieWrites).toEqual(['appearance=; path=/; max-age=0; SameSite=Lax; Secure']);
  });
});
