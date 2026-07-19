const SENSITIVE_KEYS = [
  'password',
  'passwordConfirmation',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'set-cookie',
  'apiKey',
  'secret',
  'clientSecret',
  'privateKey',
  'smtpPassword',
  'databaseUrl',
];

export function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[_-]/g, '').toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive.toLowerCase()));
}

export function redactSensitive<T>(value: T, depth = 0): T | string | unknown[] | Record<string, unknown> {
  if (depth > 6) return '[REDACTED_DEPTH]';
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = isSensitiveKey(key) ? '[REDACTED]' : redactSensitive(item, depth + 1);
    }
    return out;
  }
  return value;
}
