export const KYC_BLOCK_KEYS = [
  'economics',
  'business_model',
  'customers',
  'tech_stack',
  'critical_processes',
  'sector_context',
] as const;

export type KycBlockKey = (typeof KYC_BLOCK_KEYS)[number];

/** Iconos inline SVG en `KycInlineIcons.tsx` (sin emojis). */
export type KycBlockIconKey = 'money' | 'compass' | 'people' | 'chip' | 'workflow' | 'globe';

export const KYC_BLOCK_META: Record<KycBlockKey, { label: string; icon: KycBlockIconKey }> = {
  economics: { label: 'Economía', icon: 'money' },
  business_model: { label: 'Modelo de negocio', icon: 'compass' },
  customers: { label: 'Clientes', icon: 'people' },
  tech_stack: { label: 'Stack tecnológico (perfil)', icon: 'chip' },
  critical_processes: { label: 'Procesos críticos', icon: 'workflow' },
  sector_context: { label: 'Contexto sector', icon: 'globe' },
};

export const KYC_REL_TYPES = ['aliado', 'bloqueador', 'influencer', 'mentor', 'rival', 'otro'] as const;
export type KycRelType = (typeof KYC_REL_TYPES)[number];

/** Partners / competencia en el resumen KYC (tags + texto + momentum). */
export const KYC_COMPETENCIA_AMBITOS = ['tecnico', 'funcional', 'estrategia'] as const;
export type KycCompetenciaAmbito = (typeof KYC_COMPETENCIA_AMBITOS)[number];

export const KYC_COMPETENCIA_AMBITO_LABELS: Record<KycCompetenciaAmbito, string> = {
  tecnico: 'Técnico',
  funcional: 'Funcional',
  estrategia: 'Estrategia',
};

export const KYC_COMPETENCIA_MOMENTUM = ['bien', 'neutro', 'debil', 'riesgo'] as const;
export type KycCompetenciaMomentum = (typeof KYC_COMPETENCIA_MOMENTUM)[number];

export const KYC_COMPETENCIA_MOMENTUM_LABELS: Record<KycCompetenciaMomentum, string> = {
  bien: 'Bien posicionado',
  neutro: 'Neutro',
  debil: 'Débil',
  riesgo: 'En riesgo',
};
