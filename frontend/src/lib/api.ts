const getBaseUrl = () =>
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? '')
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
  return fetch(`${getBaseUrl()}${path}`, { ...init, headers });
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
