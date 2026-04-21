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

Campo scoreJustifications (obligatorio para cada dimension M, E, D1, D2, P, I, C1, C2):
- Un solo texto corrido por dimension, en espanol, como mucho 3 oraciones (conciso; evita parrafos largos para no truncar el JSON).
- Analiza la CALIDAD de las respuestas del usuario (y el contexto/adjuntos) para ESA dimension: fortalezas, vacios, ambiguedades, riesgos.
- Conecta el razonamiento con el score numerico que asignas: si el score es alto pero las respuestas son vagas, dilo; si el score es bajo pero hay buen detalle, explica el gap (p. ej. falta validacion con el Economic Buyer).
- Indica en que deberia trabajar el comercial a continuacion (validaciones, reuniones, datos que faltan).
- No te limites a repetir la etiqueta de la escala: interpreta el contenido como haria un director de ventas.
Responde SOLO con JSON valido, sin markdown, sin explicaciones fuera del JSON.`;

/** Orden alineado con frontend MEDDPICC_DIMENSIONS (8 dimensiones). */
export const MEDDPICC_DIMENSION_KEYS = ['M', 'E', 'D1', 'D2', 'P', 'I', 'C1', 'C2'] as const;

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
${params.additionalContext ? `INFORMACION ADICIONAL (notas del usuario y/o sesión de voz ConvAI):\n${params.additionalContext}` : ''}

dealStatusBanner (obligatorio):
- Objeto con "tone": uno de "critical", "warning", "caution", "positive" segun salud global del deal y peores dimensiones.
- "title": titulo corto en espanol (puede empezar por emoji como 🚨 o ⚠️ si encaja).
- "body": 1-2 frases: mensaje ejecutivo para el comercial (invertir tiempo, redirigir esfuerzos, prioridades).

criticalActions (obligatorio, array):
- Entre 3 y 6 objetos, priorizando las dimensiones con scores MAS BAJOS (mayor urgencia).
- Cada objeto: "dimensionKey" (M, E, D1, D2, P, I, C1 o C2), "name" (nombre en ingles como en MEDDPICC: Metrics, Economic Buyer, ...), "emoji" (un emoji relevante), "score" (0-10, alineado con el score que asignas a esa dimension), "advice" (como mucho 3 frases en espanol).

areasToReinforce (obligatorio, array):
- Entre 2 y 4 objetos para dimensiones con score INTERMEDIO (típico 5-7): no son las peores pero hay que reforzar antes del cierre.
- Misma forma que criticalActions: dimensionKey, name, emoji, score, advice.

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
  "scoreJustifications": { "M": "texto corrido 2-5 oraciones: calidad de respuestas, brechas, mejoras", "E": "...", "D1": "...", "D2": "...", "P": "...", "I": "...", "C1": "...", "C2": "..." },
  "dealStatusBanner": { "tone": "critical", "title": "titulo", "body": "texto" },
  "criticalActions": [
    { "dimensionKey": "I", "name": "Identified Pain", "emoji": "🔥", "score": 1, "advice": "texto accionable" }
  ],
  "areasToReinforce": [
    { "dimensionKey": "E", "name": "Economic Buyer", "emoji": "💰", "score": 6, "advice": "texto" }
  ],
  "nextQuestions": ["pregunta 1", "pregunta 2", "pregunta 3"],
  "overallAssessment": "parrafo largo estilo valoracion IA: diagnostico del deal, tension entre oportunidad y riesgos, recomendacion principal",
  "risks": ["riesgo 1", "riesgo 2"],
  "strengths": ["fortaleza 1", "fortaleza 2"]
}

REGLAS:
- Si en INFORMACION ADICIONAL hay una seccion "Evidencia de la ultima sesion de voz", usala para inferir o completar respuestas y ajustar scores cuando haya datos claros en esa transcripcion o resumen.
- Solo rellena answers donde haya evidencia en el contexto. Deja vacio ("") donde no hay datos.
- NO inventes informacion.
- Mantiene las respuestas previas del usuario si existen.
- Scores conservadores: sin evidencia = score bajo.
- scoreJustifications: narrativa cualitativa por dimension (ver instrucciones del system prompt); si casi no hay respuestas en esa dimension, indica que falta informacion y que validar.
- overallAssessment: un solo parrafo (como mucho 6 oraciones), tono de director de ventas; sin listas internas.
- dealStatusBanner, criticalActions y areasToReinforce: obligatorios y coherentes con los scores.
- nextQuestions: exactamente 6 u 8 preguntas (no mas de 8), concretas para la proxima reunion, en espanol.
- CRITICO: la salida debe ser UN UNICO JSON valido, sin texto antes ni despues, sin comillas tipograficas; escapa comillas dobles dentro de strings con \". No cortes el JSON a medias.
- Responde en espanol (salvo los nombres de dimension en ingles en name).`;
}
