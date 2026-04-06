import { RFQ_SAP_ARCHITECT_CONTEXT } from './rfq-sap-architect-context';

/**
 * Prompt de síntesis estructurada. El modelo debe devolver solo un objeto JSON válido.
 */
export function buildRfqSynthesisPrompt(params: {
  title: string;
  normalizedBundle: string;
}): string {
  return `${RFQ_SAP_ARCHITECT_CONTEXT}

────────────────────────────────────────
TAREA: SÍNTESIS ESTRUCTURADA (SALIDA = SOLO JSON)
────────────────────────────────────────

Eres también consultor senior en transformación digital, cloud e integración (Europa). Los textos del JSON deben estar en español (salvo nombres de productos SAP habituales en inglés).

Analiza la documentación de oportunidad / RFQ / RFP siguiente y produce un único JSON que siga exactamente el esquema indicado. No incluyas markdown ni texto fuera del JSON.

Título del análisis (referencia): ${JSON.stringify(params.title)}

Documentación consolidada (puede incluir varias fuentes etiquetadas):
---
${params.normalizedBundle}
---

MAPEO DEL ANÁLISIS ARQUITECTÓNICO AL JSON (obligatorio cuando la propuesta sea SAP o lo mencione; si no aplica SAP, adapta con el mismo rigor técnico):
- "executiveSummary": resumen ejecutivo orientado a negocio (equivalente a sección 1) e incluye en una frase final la clasificación de madurez (Moderna/bien alineada · Aceptable pero mejorable · Orientada a legacy / alto riesgo de deuda técnica) cuando puedas justificarla.
- "functionalVision": visión funcional / negocio alineada con lo anterior.
- "technicalVision": debe cubrir de forma explícita en prosa coherente: landscape identificado (ECC/S/4/híbrido), enfoque arquitectónico, patrones legacy detectados, evaluación frente a principios modernos (Clean Core, BTP, Integration Suite según aplique), y mejoras recomendadas adaptadas a ECC vs S/4.
- "risksAndUnknowns": riesgos técnicos y arquitectónicos, limitaciones de upgrade, deuda, escalabilidad, seguridad/cumplimiento, gaps de información.
- "recommendedQuestions": preguntas o siguientes pasos concretos (equivalente a refinar mejoras en formato pregunta).
- "confidenceNotes": límites del análisis, datos faltantes; puedes reforzar aquí el razonamiento breve de la clasificación de madurez si hace falta espacio.

Esquema JSON obligatorio (todas las claves en camelCase):
{
  "executiveSummary": string (breve, 3-8 frases; incluir veredicto de madurez si procede),
  "opportunityType": string (clasificación corta, p.ej. "RFP SAP S/4", "Consultoría integración", "Assessment cloud"),
  "detectedTechnologies": array de objetos { "name": string, "confidence": "alta"|"media"|"baja", "notes": string opcional },
  "avvaleAreas": array de objetos {
    "unit": "RUN" | "GROW" | "WISE" | "YUBIQ" | "SAIBORG",
    "rationale": string (1-4 frases: por qué esta unidad de negocio Avvale encaja con la oportunidad),
    "confidence": "alta"|"media"|"baja"
  },
  "functionalVision": string (visión funcional / negocio),
  "technicalVision": string (visión técnica / arquitectura; SAP: landscape, patrones, principios, mejoras),
  "risksAndUnknowns": string (riesgos, gaps, dependencias),
  "recommendedQuestions": array de strings (siguientes preguntas o próximos pasos),
  "confidenceNotes": string (límites del análisis, datos faltantes)
}

Sobre "avvaleAreas" (obligatorio seguir la estructura de objetos):
- Incluye solo las unidades que sean razonablemente relevantes según el RFQ (pueden ser varias o ninguna; si ninguna encaja, usa array vacío []).
- Cada "unit" debe ser exactamente uno de: RUN, GROW, WISE, YUBIQ, SAIBORG (mayúsculas).
- Guía de clasificación (elige según el tema dominante de la oportunidad; puedes repetir criterios en rationale):
  · RUN: infraestructura, comunicaciones, operación, monitorización, upgrades, instalaciones, Basis, administración cloud/on-prem, soporte técnico, AMS funcional, operación SAP o no SAP.
  · GROW: implementación funcional, procesos, consultoría funcional, T&M funcional, desarrollo ABAP, assessments funcionales.
  · SAIBORG: integración (Mulesoft, SAP Integration Suite, Boomi), middleware, datos (Power BI, Tableau, Datasphere, SAC), federación del dato, IA, Fiori, BTP, CAP, OpenPlatform.
  · WISE: EPM, ESG, presupuestación, consolidación financiera, CFO, planning.
  · YUBIQ: productos Avvale, B+, compliance, menciones explícitas a YUBIQ o propuesta alineada con ese segmento.
- "rationale" debe nombrar explícitamente la unidad (p. ej. "YUBIQ:") y conectar la oportunidad con su alcance típico.

Si falta información, dilo en confidenceNotes y risksAndUnknowns sin inventar datos concretos de cliente.`;
}
