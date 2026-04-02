export type AreaCompania = 'RUN' | 'GROW' | 'SAIBORG' | 'WISE' | 'YUBIQ';
export type DealType = 'New Opportunity' | 'Renovación' | 'Upsell';

export type ConfidenceMap = {
  titulo: number;
  nombreCliente: number;
  importeOferta: number;
  areaCompania: number;
  resumen: number;
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

export type AnalysisLogItem = string;

export type AnalyzeOfferResponse = {
  success: boolean;
  fileName: string;
  cleanTitleFromFilename: string;
  extractedTextLength: number;
  result: ClaudeOfferExtraction;
  rawClaudeJson: string;
  modelUsed: string;
  log: AnalysisLogItem[];
};

export type UserAnthropicCredentialStatus = {
  configured: boolean;
  masked: string | null;
};

export type AnthropicModelChoice = 'haiku' | 'sonnet' | 'opus';

