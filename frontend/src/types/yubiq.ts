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
  /** Nota fija bajo el importe si solo tarifa T&M sin jornadas (viene del backend). */
  notaInterpretacionImporte?: string;
  /** 10.000 cuando aplica la nota T&M sin jornadas; usar como revenue en Yubiq. */
  importeRevenueTmSinJornadasNumerico?: number | null;
  /** Total € sobre periodo de compromiso (proyecto + mensual × meses), si el backend lo calculó. */
  importeTotalConCompromisoNumerico?: number | null;
  importeTotalConCompromisoTexto?: string | null;
  notaImporteCompromiso?: string | null;
  /** Aviso: varias opciones/rangos; se usa el escenario de mayor importe. */
  notaMultiplesOpcionesPrecio?: string;
  numeroOpcionesPrecioEstimado?: number | null;
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
  /** Prompt completo enviado a Claude (incluye texto del PDF). */
  promptPreview?: string;
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

