export type AreaCompania = 'RUN' | 'GROW' | 'SAIBORG' | 'WISE' | 'YUBIQ';
export type DealType = 'New Opportunity' | 'Renovación' | 'Upsell';

export type ConfidenceMap = {
  titulo: number;
  nombreCliente: number;
  importeOferta: number;
  areaCompania: number;
  resumen: number;
};

export type ClaudeOfferExtractionInternal = {
  titulo: string | null;
  nombreCliente: string | null;
  importeOferta: string | null;
  areaCompania: AreaCompania | string | null;
  resumen: string | null;
  observaciones: string | null;
  dealType?: DealType | string | null;
  confidence: Partial<Record<keyof ConfidenceMap, unknown>>;
  // futuro:
  areaAvvale?: string | null;
};

export type ClaudeOfferExtraction = {
  titulo: string;
  nombreCliente: string;
  importeOferta: string;
  areaCompania: AreaCompania | null;
  resumen: string;
  observaciones: string;
  confidence: ConfidenceMap;
  // futuro:
  dealType?: DealType | null;
  areaAvvale?: string | null;
};

