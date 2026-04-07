/** Alineado con `UserIndustry` en Prisma / API. */
export const USER_INDUSTRY_OPTIONS = [
  { value: 'ENERGY_PUBLIC_SECTOR', label: 'Energy & Public Sector' },
  { value: 'CONSUMER_MARKETS', label: 'Consumer Markets' },
  { value: 'LIFESTYLE_SERVICES', label: 'Lifestyle & Services' },
  { value: 'INDUSTRIAL_CORPORATE_MARKETS', label: 'Industrial & Corporate Markets' },
] as const;

export type UserIndustryValue = (typeof USER_INDUSTRY_OPTIONS)[number]['value'];

export function industryLabel(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const found = USER_INDUSTRY_OPTIONS.find((o) => o.value === value);
  return found?.label ?? value;
}
