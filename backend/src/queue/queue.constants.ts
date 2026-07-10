/** Nombre de cola BullMQ para envío de activaciones al webhook de Make. */
export const ACTIVATION_SEND_QUEUE = 'activation-send';

/** Tipo de trabajo dentro de la cola (nombre del job). */
export const ACTIVATION_SEND_JOB_NAME = 'send';

/** Cola BullMQ para pipeline de análisis RFQ (extracción + síntesis). */
export const RFQ_ANALYSIS_QUEUE = 'rfq-analysis';

export const RFQ_ANALYSIS_JOB_NAME = 'process';

/** Cola BullMQ para extracción IA de gastos creados por email. */
export const EXPENSE_EXTRACT_QUEUE = 'expense-extract';

export const EXPENSE_EXTRACT_JOB_NAME = 'extract';
