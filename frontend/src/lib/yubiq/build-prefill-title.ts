/**
 * Construye `prefill.title`: titulo + " - " + cliente.
 * Si falta uno, solo el existente. Trim y sin guiones ni espacios duplicados.
 */
export function buildPrefillTitle(titulo: string, cliente: string): string {
  const t = titulo.trim().replace(/\s+/g, ' ');
  const c = cliente.trim().replace(/\s+/g, ' ');
  if (!t && !c) return '';
  if (!t) return c;
  if (!c) return t;
  return `${t} - ${c}`;
}
