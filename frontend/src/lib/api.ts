/** Si está vacío en el cliente, las peticiones van al mismo origen del Next (p. ej. /api → rewrite) y evitas problemas de CORS con 127.0.0.1 vs localhost. */
const getBaseUrl = () =>
  typeof window !== 'undefined'
    ? (process.env.NODE_ENV === 'development' ? '' : (process.env.NEXT_PUBLIC_API_URL ?? ''))
    : process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Construye la URL final. Las rutas del front usan prefijo `/api/...` para el rewrite de Next;
 * si `NEXT_PUBLIC_API_URL` apunta directo al Nest (sin proxy que duplique `/api`), hay que
 * pedir `/auth/...` y no `/api/auth/...` para alinear con el backend sin `setGlobalPrefix('api')`.
 */
export function resolveApiUrl(path: string): string {
  const base = getBaseUrl();
  if (!base) return path;
  const b = base.replace(/\/$/, '');
  if (path === '/api' || path === '/api/') return b;
  if (path.startsWith('/api/')) {
    return `${b}/${path.slice(5)}`;
  }
  return `${b}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
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
