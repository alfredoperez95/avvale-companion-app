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
  /** Señal del modelo: solo tarifas T&M sin jornadas/dedicación explícita. */
  soloImporteTarifaTmSinJornadas?: boolean | null;
  /**
   * Importe único de proyecto/implementación (€), si el documento lo desglosa.
   * Debe ser número (o el modelo puede enviar string numérica europea).
   */
  importeProyectoEuros?: number | string | null;
  /** Cuota mensual recurrente (€), si consta. */
  importeMensualEuros?: number | string | null;
  /**
   * Duración del compromiso en meses (p. ej. 3 años → 36).
   * El modelo debe inferirla del texto del documento.
   */
  periodoCompromisoMeses?: number | string | null;
  /** Cita breve del periodo en el documento (p. ej. "3 años", "36 meses"). */
  periodoCompromisoTexto?: string | null;
  /**
   * true si el documento presenta más de un escenario económico (varias opciones, modalidades,
   * paquetes, o un rango min–max). No tiene por qué ser exactamente dos.
   */
  multiplesOpcionesPrecio?: boolean | null;
  /**
   * Cuántas opciones o líneas de precio comparables identifica (2, 3, 4…). null si no es inferible.
   */
  numeroOpcionesPrecioEstimado?: number | string | null;
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
  /** Texto fijo si solo importe tarifa T&M sin jornadas (ver normalizer). */
  notaInterpretacionImporte?: string;
  /**
   * Si aplica nota T&M sin jornadas: importe a usar en revenue (10.000 € bolsa mínima).
   */
  importeRevenueTmSinJornadasNumerico?: number | null;
  /**
   * Total (€) sobre el periodo de compromiso: proyecto + mensual × meses, si se pudo calcular.
   * Entero en euros; usar para revenue Yubiq cuando exista.
   */
  importeTotalConCompromisoNumerico?: number | null;
  /** Misma cifra formateada para UI (p. ej. "17.030 €"). */
  importeTotalConCompromisoTexto?: string | null;
  /** Explica el cálculo o cita el compromiso del documento. */
  notaImporteCompromiso?: string | null;
  /** Aviso fijo si hay varias opciones/rangos de precio (escenario de mayor importe). */
  notaMultiplesOpcionesPrecio?: string;
  /** Recuento opcional expuesto para UI (p. ej. badge). */
  numeroOpcionesPrecioEstimado?: number | null;
  // futuro:
  dealType?: DealType | null;
  areaAvvale?: string | null;
};

