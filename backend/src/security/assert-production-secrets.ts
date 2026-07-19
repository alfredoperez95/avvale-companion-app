/**
 * Abortar arranque en producción si los secretos son débiles o por defecto.
 * Evita desplegar con JWT_SECRET=change-me-in-production.
 */

const WEAK_SECRET_VALUES = new Set([
  '',
  'change-me-in-production',
  'changeme',
  'secret',
  'jwt-secret',
  'password',
  '123456',
]);

function isWeakSecret(value: string | undefined): boolean {
  const v = value?.trim() ?? '';
  if (v.length < 32) return true;
  if (WEAK_SECRET_VALUES.has(v.toLowerCase())) return true;
  return false;
}

export function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const jwt = process.env.JWT_SECRET;
  const magic =
    process.env.MAGIC_LINK_SECRET?.trim() ||
    process.env.JWT_SECRET;
  const invite =
    process.env.INVITE_TOKEN_SECRET?.trim() ||
    process.env.MAGIC_LINK_SECRET?.trim() ||
    process.env.JWT_SECRET;

  const problems: string[] = [];
  if (!process.env.DATABASE_URL?.trim()) {
    problems.push('DATABASE_URL debe estar definido en producción.');
  }
  if (isWeakSecret(jwt)) {
    problems.push(
      'JWT_SECRET debe estar definido, no ser un valor por defecto, y tener al menos 32 caracteres.',
    );
  }
  if (isWeakSecret(magic)) {
    problems.push(
      'MAGIC_LINK_SECRET (o JWT_SECRET como fallback) debe ser fuerte (≥32 caracteres, no por defecto).',
    );
  }
  if (isWeakSecret(invite)) {
    problems.push(
      'INVITE_TOKEN_SECRET (o MAGIC_LINK_SECRET/JWT_SECRET como fallback) debe ser fuerte (≥32 caracteres, no por defecto).',
    );
  }

  const cors = (process.env.CORS_ORIGIN || '').trim();
  if (!cors) {
    problems.push(
      'CORS_ORIGIN debe listar el/los orígenes HTTPS del frontend en producción.',
    );
  }
  if (process.env.MAIL_SKIP_SEND === 'true') {
    problems.push('MAIL_SKIP_SEND no puede estar activo en producción porque expone enlaces de acceso en logs.');
  }

  if (problems.length === 0) return;

  const message = `[seguridad] Arranque abortado en producción:\n- ${problems.join('\n- ')}`;
  throw new Error(message);
}
