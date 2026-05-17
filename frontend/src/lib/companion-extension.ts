/** Ficha oficial en Chrome Web Store (instalación recomendada). */
export const CHROME_WEB_STORE_COMPANION_URL =
  'https://chromewebstore.google.com/detail/avvale-companion/afpdgamffgonkjblodeiefibbobmaibg';

/** Documentación interna opcional (variable de entorno). */
export const LAUNCHER_EXTENSION_HELP_URL =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_LAUNCHER_EXTENSION_HELP_URL
    ? process.env.NEXT_PUBLIC_LAUNCHER_EXTENSION_HELP_URL.trim()
    : '';
