import { BadRequestException } from '@nestjs/common';

/** Alineado con `USER_INDUSTRY_OPTIONS` en el frontend (`@/lib/user-industry`). */
export const KYC_COMPANY_INDUSTRY_VALUES = [
  'ENERGY_PUBLIC_SECTOR',
  'CONSUMER_MARKETS',
  'LIFESTYLE_SERVICES',
  'INDUSTRIAL_CORPORATE_MARKETS',
] as const;

const ALLOWED = new Set<string>(KYC_COMPANY_INDUSTRY_VALUES);

/** Vacío o ausente → null. Valor desconocido → 400. */
export function normalizeKycCompanyIndustry(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (!ALLOWED.has(s)) {
    throw new BadRequestException(
      `Industria no válida. Use: ${KYC_COMPANY_INDUSTRY_VALUES.join(', ')}`,
    );
  }
  return s;
}
