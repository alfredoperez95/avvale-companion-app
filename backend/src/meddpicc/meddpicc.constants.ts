/** System prompt MEDDPICC (alineado con la app standalone). */
export const MEDDPICC_SYSTEM = `Eres un experto en ventas B2B enterprise y metodologia MEDDPICC. Tu trabajo es analizar la informacion disponible de un deal y devolver un analisis MEDDPICC estructurado en JSON.

Las 8 dimensiones MEDDPICC:
- M (Metrics): Metricas cuantificables del impacto de negocio. Preguntas clave: impacto economico, KPIs de exito, validacion con cliente.
- E (Economic Buyer): Quien tiene poder de decision y presupuesto. Preguntas clave: identificacion, acceso directo, conocer sus prioridades.
- D1 (Decision Criteria): Criterios tecnicos y de negocio. Preguntas clave: criterios tecnicos, criterios de negocio, capacidad de influencia.
- D2 (Decision Process): Pasos y timeline de decision. Preguntas clave: fases del proceso, timeline con fechas, participantes en cada fase.
- P (Paper Process): Proceso legal y procurement. Preguntas clave: proceso de compras, requisitos legales, presupuesto aprobado.
- I (Identified Pain): Dolor de negocio que impulsa la iniciativa. Preguntas clave: dolor principal, coste de inaccion, si el EB siente el dolor.
- C1 (Champion): Aliado interno en la organizacion. Preguntas clave: existencia, influencia real, si comparte info proactivamente.
- C2 (Competition): Panorama competitivo. Preguntas clave: competidores identificados, fortalezas/debilidades, estrategia de diferenciacion.

IDs de preguntas por dimension:
- M: M1 (impacto economico), M2 (KPIs definidos), M3 (metricas validadas con cliente)
- E: E1 (EB identificado), E2 (acceso directo), E3 (prioridades del EB)
- D1: D1_1 (criterios tecnicos), D1_2 (criterios negocio), D1_3 (influencia en criterios)
- D2: D2_1 (fases decision), D2_2 (timeline fechas), D2_3 (participantes por fase)
- P: P1 (proceso compras), P2 (requisitos legales), P3 (presupuesto aprobado)
- I: I1 (dolor principal), I2 (coste inaccion), I3 (dolor sentido por EB)
- C1: C1_1 (champion existe), C1_2 (influencia real), C1_3 (comparte info)
- C2: C2_1 (competidores conocidos), C2_2 (fortalezas/debilidades), C2_3 (estrategia diferenciacion)

Escala de puntuacion (0-10):
- 0: Sin datos
- 1-3: Informacion muy limitada o riesgo alto
- 4-5: Informacion parcial, requiere trabajo
- 6-7: Buena informacion, algunos gaps
- 8-9: Informacion solida
- 10: Completo y validado

IMPORTANTE: Se conservador en los scores. Es mejor subestimar que sobreestimar. Si no hay evidencia clara, pon score bajo.
Responde SOLO con JSON valido, sin markdown, sin explicaciones fuera del JSON.`;

export function buildMeddpiccUserPrompt(params: {
  name: string;
  company: string;
  commercialLabel: string;
  value: string;
  context: string | null;
  currentAnswers: Record<string, string>;
  currentScores: Record<string, number>;
  additionalContext?: string;
}): string {
  const answersText = Object.entries(params.currentAnswers)
    .filter(([, v]) => String(v ?? '').trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  const scoresText = Object.entries(params.currentScores)
    .map(([k, v]) => `${k}: ${v}/10`)
    .join(', ');

  return `Analiza este deal y devuelve un JSON con la estructura exacta que te pido.

DEAL: ${params.name}
EMPRESA: ${params.company}
COMERCIAL: ${params.commercialLabel}
VALOR: ${params.value || 'No especificado'}

CONTEXTO DEL DEAL (texto libre y/o contenido en Markdown extraído de adjuntos: PDF, Excel, Word, email .eml):
${params.context?.trim() ? params.context.trim() : 'Sin contexto proporcionado'}

${answersText ? `RESPUESTAS PREVIAS:\n${answersText}` : ''}
${scoresText ? `SCORES ACTUALES: ${scoresText}` : ''}
${params.additionalContext ? `INFORMACION ADICIONAL:\n${params.additionalContext}` : ''}

Devuelve EXACTAMENTE este JSON (sin backticks, sin markdown):
{
  "answers": {
    "M1": "respuesta inferida o vacio si no hay datos",
    "M2": "...", "M3": "...",
    "E1": "...", "E2": "...", "E3": "...",
    "D1_1": "...", "D1_2": "...", "D1_3": "...",
    "D2_1": "...", "D2_2": "...", "D2_3": "...",
    "P1": "...", "P2": "...", "P3": "...",
    "I1": "...", "I2": "...", "I3": "...",
    "C1_1": "...", "C1_2": "...", "C1_3": "...",
    "C2_1": "...", "C2_2": "...", "C2_3": "..."
  },
  "scores": { "M": 0, "E": 0, "D1": 0, "D2": 0, "P": 0, "I": 0, "C1": 0, "C2": 0 },
  "scoreJustifications": { "M": "razon", "E": "...", "D1": "...", "D2": "...", "P": "...", "I": "...", "C1": "...", "C2": "..." },
  "nextQuestions": ["pregunta 1", "pregunta 2", "pregunta 3"],
  "overallAssessment": "resumen ejecutivo en 2-3 frases",
  "risks": ["riesgo 1", "riesgo 2"],
  "strengths": ["fortaleza 1", "fortaleza 2"]
}

REGLAS:
- Solo rellena answers donde haya evidencia en el contexto. Deja vacio ("") donde no hay datos.
- NO inventes informacion.
- Mantiene las respuestas previas del usuario si existen.
- Scores conservadores: sin evidencia = score bajo.
- nextQuestions: preguntas concretas y accionables para el comercial.
- Responde en espanol.`;
}
