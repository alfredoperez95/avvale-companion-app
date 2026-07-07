import { ConfigService } from '@nestjs/config';

export const EXPENSE_DEFAULT_MAX_FILE_BYTES = 20 * 1024 * 1024;

export function getExpenseMaxFileBytes(config: ConfigService): number {
  const raw = config.get<string>('EXPENSE_MAX_FILE_BYTES');
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : EXPENSE_DEFAULT_MAX_FILE_BYTES;
}
