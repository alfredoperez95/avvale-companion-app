/** Lee el nonce CSP expuesto por el root layout (meta) para Client Components. */
export function readCspNonceFromDom(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') ?? undefined;
}
