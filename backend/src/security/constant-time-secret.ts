import { createHash, timingSafeEqual } from 'crypto';

export function isSameSecret(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string') return false;
  const providedHash = createHash('sha256').update(provided).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}
