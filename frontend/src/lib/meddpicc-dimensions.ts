/** Definición MEDDPICC (alineada con la app standalone). */
export type MeddpiccQuestionDef = { id: string; q: string; hint: string };

export type MeddpiccDimensionDef = {
  key: string;
  name: string;
  color: string;
  description: string;
  questions: MeddpiccQuestionDef[];
  scoreGuide: Record<number, string>;
};

export const MEDDPICC_DIMENSIONS: MeddpiccDimensionDef[] = [
  {
    key: 'M',
    name: 'Metrics',
    color: '#6366f1',
    description: 'Metricas cuantificables del impacto de negocio',
    questions: [
      { id: 'M1', q: '¿Cual es el impacto economico del problema que resolvemos?', hint: 'Busca cifras concretas: ahorro, ingresos, eficiencia.' },
      { id: 'M2', q: '¿Tiene el cliente KPIs definidos para medir el exito del proyecto?', hint: 'ROI esperado, payback period, mejora de SLA.' },
      { id: 'M3', q: '¿Hemos validado estas metricas con el cliente?', hint: 'Si las metricas son nuestras o del cliente.' },
    ],
    scoreGuide: { 0: 'Sin datos', 3: 'Estimaciones nuestras', 5: 'Metricas parciales del cliente', 7: 'KPIs validados', 10: 'Business case firmado' },
  },
  {
    key: 'E',
    name: 'Economic Buyer',
    color: '#8b5cf6',
    description: 'Quien tiene el poder de decision y el presupuesto',
    questions: [
      { id: 'E1', q: '¿Hemos identificado al Economic Buyer (persona con poder de firma)?', hint: 'CEO, CFO, CIO, VP... quien firma el cheque.' },
      { id: 'E2', q: '¿Hemos tenido acceso directo a esta persona?', hint: 'Reunion, call, email directo.' },
      { id: 'E3', q: '¿Conocemos sus prioridades personales y de negocio?', hint: 'Que le quita el sueno, que KPIs tiene.' },
    ],
    scoreGuide: { 0: 'No identificado', 3: 'Identificado sin acceso', 5: 'Acceso indirecto', 7: 'Reunion directa', 10: 'Relacion solida y alineacion' },
  },
  {
    key: 'D1',
    name: 'Decision Criteria',
    color: '#ec4899',
    description: 'Criterios tecnicos y de negocio para la decision',
    questions: [
      { id: 'D1_1', q: '¿Conocemos los criterios de decision tecnicos del cliente?', hint: 'Requisitos tecnicos, integraciones, compliance.' },
      { id: 'D1_2', q: '¿Conocemos los criterios de decision de negocio?', hint: 'Precio, time-to-value, referencias del sector.' },
      { id: 'D1_3', q: '¿Podemos influir en los criterios a nuestro favor?', hint: 'Diferenciadores que solo nosotros tenemos.' },
    ],
    scoreGuide: { 0: 'Desconocidos', 3: 'Parcialmente conocidos', 5: 'Conocidos sin influencia', 7: 'Conocidos e influidos', 10: 'Criterios alineados con nosotros' },
  },
  {
    key: 'D2',
    name: 'Decision Process',
    color: '#f43f5e',
    description: 'Pasos y timeline del proceso de decision',
    questions: [
      { id: 'D2_1', q: '¿Conocemos las fases del proceso de decision?', hint: 'Evaluacion, shortlist, POC, negociacion, firma.' },
      { id: 'D2_2', q: '¿Tenemos un timeline claro con fechas?', hint: 'Fecha objetivo de decision, hitos intermedios.' },
      { id: 'D2_3', q: '¿Sabemos quien participa en cada fase?', hint: 'Comite de evaluacion, legal, procurement, IT.' },
    ],
    scoreGuide: { 0: 'Proceso desconocido', 3: 'Fases generales', 5: 'Proceso documentado', 7: 'Timeline con fechas', 10: 'Proceso validado con el EB' },
  },
  {
    key: 'P',
    name: 'Paper Process',
    color: '#f97316',
    description: 'Proceso legal y de procurement',
    questions: [
      { id: 'P1', q: '¿Conocemos el proceso de compras/procurement?', hint: 'Licitacion, compras directas, acuerdo marco.' },
      { id: 'P2', q: '¿Sabemos los requisitos legales y contractuales?', hint: 'Terminos legales, SLAs, seguros, certificaciones.' },
      { id: 'P3', q: '¿Hay presupuesto aprobado o se debe solicitar?', hint: 'Budget ya asignado vs pendiente de aprobacion.' },
    ],
    scoreGuide: { 0: 'Sin visibilidad', 3: 'Proceso general conocido', 5: 'Requisitos identificados', 7: 'Documentacion en curso', 10: 'Contrato en negociacion/firmado' },
  },
  {
    key: 'I',
    name: 'Identified Pain',
    color: '#14b8a6',
    description: 'El dolor de negocio que impulsa la iniciativa',
    questions: [
      { id: 'I1', q: '¿Cual es el dolor principal del cliente?', hint: 'Problema concreto que les cuesta dinero o tiempo.' },
      { id: 'I2', q: '¿Que pasa si no hacen nada? (coste de la inaccion)', hint: 'Riesgo, perdida de mercado, ineficiencia creciente.' },
      { id: 'I3', q: '¿El dolor lo siente el Economic Buyer o solo el equipo tecnico?', hint: 'Si el EB no siente el dolor, el deal pierde urgencia.' },
    ],
    scoreGuide: { 0: 'Pain no identificado', 3: 'Pain tecnico', 5: 'Pain de negocio', 7: 'Pain validado con EB', 10: 'Pain critico con urgencia' },
  },
  {
    key: 'C1',
    name: 'Champion',
    color: '#22c55e',
    description: 'Nuestro aliado interno en la organizacion del cliente',
    questions: [
      { id: 'C1_1', q: '¿Tenemos un champion dentro de la organizacion?', hint: 'Alguien que nos defiende internamente.' },
      { id: 'C1_2', q: '¿Tiene influencia real en la decision?', hint: 'Acceso al EB, credibilidad interna, poder informal.' },
      { id: 'C1_3', q: '¿Nos comparte informacion interna proactivamente?', hint: 'Nos avisa de cambios, nos da intel de la competencia.' },
    ],
    scoreGuide: { 0: 'Sin champion', 3: 'Contacto amigable', 5: 'Champion con influencia limitada', 7: 'Champion con acceso al EB', 10: 'Champion activo vendiendo internamente' },
  },
  {
    key: 'C2',
    name: 'Competition',
    color: '#64748b',
    description: 'Panorama competitivo y nuestra posicion',
    questions: [
      { id: 'C2_1', q: '¿Sabemos contra quien competimos?', hint: 'Competidores directos, alternativas internas, status quo.' },
      { id: 'C2_2', q: '¿Conocemos sus fortalezas y debilidades vs nosotros?', hint: 'Precio, experiencia sectorial, relaciones, tecnologia.' },
      { id: 'C2_3', q: '¿Tenemos una estrategia clara para diferenciarnos?', hint: 'Unique selling points, traps, landmines.' },
    ],
    scoreGuide: { 0: 'Competencia desconocida', 3: 'Competidores identificados', 5: 'Fortalezas/debilidades conocidas', 7: 'Estrategia de diferenciacion', 10: 'Posicion dominante clara' },
  },
];

export const MEDDPICC_SCORE_LABELS: Record<number, string> = {
  0: 'Sin datos',
  1: 'Muy bajo',
  2: 'Bajo',
  3: 'Bajo-Medio',
  4: 'Medio-Bajo',
  5: 'Medio',
  6: 'Medio-Alto',
  7: 'Alto',
  8: 'Alto',
  9: 'Muy alto',
  10: 'Excelente',
};
