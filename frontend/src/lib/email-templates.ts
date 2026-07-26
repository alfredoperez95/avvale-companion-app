import { apiFetch } from '@/lib/api';

export type EmailTemplateItem = {
  id: string;
  name: string;
  content: string;
};

/**
 * Plantillas disponibles en activaciones.
 * Mismo origen que Configuración → Plantillas Email:
 * - ADMIN: catálogo de sistema (`?scope=system`)
 * - USER: copias personales
 */
export async function fetchActivationEmailTemplates(): Promise<EmailTemplateItem[]> {
  let scopeSystem = false;
  try {
    const meRes = await apiFetch('/api/auth/me');
    if (meRes.ok) {
      const me: unknown = await meRes.json().catch(() => null);
      const role =
        me && typeof me === 'object' && 'role' in me ? String((me as { role?: unknown }).role) : '';
      scopeSystem = role === 'ADMIN';
    }
  } catch {
    /* ignore; fallback personal */
  }
  const url = scopeSystem ? '/api/email-templates?scope=system' : '/api/email-templates';
  const res = await apiFetch(url);
  if (!res.ok) return [];
  const data: unknown = await res.json().catch(() => []);
  if (!Array.isArray(data)) return [];
  return data
    .map((row): EmailTemplateItem | null => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === 'string' ? r.id : '';
      const name = typeof r.name === 'string' ? r.name.trim() : '';
      if (!id || !name) return null;
      return {
        id,
        name,
        content: typeof r.content === 'string' ? r.content : '',
      };
    })
    .filter((t): t is EmailTemplateItem => t != null);
}
