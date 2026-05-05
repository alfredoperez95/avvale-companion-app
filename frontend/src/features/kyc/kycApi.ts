import { apiFetch, getToken, resolveApiUrl } from '@/lib/api';

function apiPath(p: string) {
  return p.startsWith('/api/') ? p : `/api${p.startsWith('/') ? p : `/${p}`}`;
}

export function kycLogout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  window.location.href = '/login';
}

export async function kycJson<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await apiFetch(apiPath(path), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as object) },
  });
  if (r.status === 401) {
    kycLogout();
    throw new Error('unauthorized');
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `HTTP ${r.status}`);
  }
  const ct = r.headers.get('content-type');
  if (!ct?.includes('application/json')) {
    return undefined as T;
  }
  return r.json() as Promise<T>;
}

/** POST; devuelve el código HTTP. No lanza por 4xx/5xx (sí 401 y logout). */
export async function kycPostStatus(path: string, init?: RequestInit): Promise<number> {
  const r = await apiFetch(apiPath(path), {
    ...init,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers as object) },
  });
  if (r.status === 401) {
    kycLogout();
    throw new Error('unauthorized');
  }
  return r.status;
}

/**
 * Stream SSE from POST /api/kyc/chat/sessions/:id/stream (mismo formato que el HTML legacy).
 */
export async function kycStreamChat(
  sessionId: number,
  message: string,
  onEvent: (eventName: string, data: unknown) => void,
): Promise<void> {
  const token = getToken();
  if (!token) {
    kycLogout();
    throw new Error('unauthorized');
  }
  const r = await fetch(resolveApiUrl(`/api/kyc/chat/sessions/${sessionId}/stream`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  if (r.status === 401) {
    kycLogout();
    throw new Error('unauthorized');
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `HTTP ${r.status}`);
  }
  const reader = r.body?.getReader();
  if (!reader) throw new Error('No body');
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const evt = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const lines = evt.split('\n');
      const eventName = (lines.find((l) => l.startsWith('event:')) || '').slice(6).trim();
      const dataLine = (lines.find((l) => l.startsWith('data:')) || '').slice(5).trim();
      if (!dataLine) continue;
      try {
        onEvent(eventName, JSON.parse(dataLine));
      } catch {
        /* empty */
      }
    }
  }
}
