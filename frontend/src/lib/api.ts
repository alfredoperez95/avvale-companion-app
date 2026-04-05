/** Si está vacío en el cliente, las peticiones van al mismo origen del Next (p. ej. /api → rewrite) y evitas problemas de CORS con 127.0.0.1 vs localhost. */
const getBaseUrl = () =>
  typeof window !== 'undefined'
    ? (process.env.NODE_ENV === 'development' ? '' : (process.env.NEXT_PUBLIC_API_URL ?? ''))
    : process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Si es true (por defecto), `/api/foo` con base `https://api.ejemplo.com` → `https://api.ejemplo.com/foo` (Nest en la raíz).
 * Si es false, se mantiene el prefijo `/api` en la URL: `https://ejemplo.com/api/foo` (proxy / CDN que solo enruta `/api/*` al backend).
 */
function shouldStripApiPrefixFromPath(): boolean {
  const v = process.env.NEXT_PUBLIC_API_STRIP_PREFIX;
  if (v === undefined || v === '') return true;
  return v === 'true' || v === '1';
}

/**
 * Construye la URL final. Las rutas del front usan prefijo `/api/...` para el rewrite de Next;
 * con `NEXT_PUBLIC_API_URL` apuntando al API, el comportamiento depende de `NEXT_PUBLIC_API_STRIP_PREFIX`.
 */
export function resolveApiUrl(path: string): string {
  const base = getBaseUrl();
  if (!base) return path;
  const b = base.replace(/\/$/, '');
  const strip = shouldStripApiPrefixFromPath();

  if (!strip) {
    return `${b}${path.startsWith('/') ? path : `/${path}`}`;
  }

  if (path === '/api' || path === '/api/') return b;
  if (path.startsWith('/api/')) {
    return `${b}/${path.slice(5)}`;
  }
  return `${b}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Si el JWT tiene `exp` y ya pasó, el token deja de considerarse válido en cliente. */
function isAccessTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const payload = JSON.parse(atob(b64)) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return false;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;
  if (isAccessTokenExpired(token)) {
    localStorage.removeItem('token');
    return null;
  }
  return token;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers: HeadersInit = {
    ...(init?.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  return fetch(resolveApiUrl(path), { ...init, headers });
}

export function apiUpload(
  path: string,
  formData: FormData,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<Response> {
  const token = getToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', resolveApiUrl(path));
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      onProgress(event.loaded, event.lengthComputable ? event.total : null);
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.onload = () => {
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
        }),
      );
    };
    xhr.send(formData);
  });
}

export { LOGIN_PATH, LOGIN_MAGIC_PATH, redirectToLogin } from './auth-routes';
