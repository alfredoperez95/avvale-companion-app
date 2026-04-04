/** Si está vacío en el cliente, las peticiones van al mismo origen del Next (p. ej. /api → rewrite) y evitas problemas de CORS con 127.0.0.1 vs localhost. */
const getBaseUrl = () =>
  typeof window !== 'undefined'
    ? (process.env.NODE_ENV === 'development' ? '' : (process.env.NEXT_PUBLIC_API_URL ?? ''))
    : process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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
  const base = getBaseUrl();
  const fullUrl = `${base}${path}`;
  // #region agent log
  if (path.includes('ai-credentials')) {
    fetch('http://127.0.0.1:7401/ingest/4ab151b9-cbda-4400-a5db-364c7cddddff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '86e2d8' },
      body: JSON.stringify({
        sessionId: '86e2d8',
        location: 'api.ts:apiFetch',
        message: 'ai-credentials request',
        data: {
          base,
          path,
          fullUrl,
          method: init?.method ?? 'GET',
          nodeEnv: process.env.NODE_ENV,
          hasPublicApiUrl: Boolean(process.env.NEXT_PUBLIC_API_URL),
        },
        timestamp: Date.now(),
        hypothesisId: 'H1',
        runId: 'post-fix',
      }),
    }).catch(() => {});
  }
  // #endregion
  return fetch(fullUrl, { ...init, headers }).then((res) => {
    // #region agent log
    if (path.includes('ai-credentials')) {
      void res
        .clone()
        .text()
        .then((bodySnippet) => {
          fetch('http://127.0.0.1:7401/ingest/4ab151b9-cbda-4400-a5db-364c7cddddff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '86e2d8' },
            body: JSON.stringify({
              sessionId: '86e2d8',
              location: 'api.ts:apiFetch:response',
              message: 'ai-credentials response',
              data: {
                status: res.status,
                statusText: res.statusText,
                bodyHead: bodySnippet.slice(0, 120),
              },
              timestamp: Date.now(),
              hypothesisId: 'H1',
              runId: 'post-fix',
            }),
          }).catch(() => {});
        })
        .catch(() => {});
    }
    // #endregion
    return res;
  });
}

export function apiUpload(
  path: string,
  formData: FormData,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<Response> {
  const token = getToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getBaseUrl()}${path}`);
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
