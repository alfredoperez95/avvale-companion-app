/** Añadir al cierre: línea fija con JSON para `extractProposedItems` en el backend. */
const SYNC_FOOTER = `

**Importante:** en la **última línea** de tu respuesta escribe exactamente (sin comillas alrededor del array):
KYC_PROPOSED_JSON: []
Cada elemento es: {"field_path": <ruta>, "value": <valor>, "source": "intake"}.
Si no hay nada que persistir, usa KYC_PROPOSED_JSON: [].

**Prioridad de persistencia**
1. Si el usuario (o tú) aporta un **hecho** concreto, usa **field_path** hacia el perfil JSON (objeto o valor escalar), no abras una open_question por eso.
1b. Si en este turno queda más claro el panorama (ficha + bloques JSON del perfil + señales) y el **resumen ejecutivo** del contexto **no** los sintetiza bien, incluye **field_path: "summary"** con un texto breve actualizado en español (sin contradecir los datos). Prioriza hechos sobre conjeturas.
2. Usa **open_question** solo para lagunas que sigan sin datos tras el mensaje. Antes mira la sección «Preguntas abiertas» del contexto: **no** repitas la misma intención (mismo ámbito y misma laguna). Si ya existe una pregunta similar, no añadas otra.
3. **Cobertura:** alterna ámbitos entre turnos: economics, business_model, customers, tech_stack, critical_processes, sector_context, competencia/partners (**competencia_partner**), organigrama (org_member), y datos de cabecera (empresa: web, empleados, etc.) sin concentrar todo en un solo bloque.
4. Si escribes un apartado **«Pendiente(s) para próxima sesión»** con preguntas numeradas o en lista, incluye **cada** pregunta también como **open_question** en KYC_PROPOSED_JSON (topic adecuado o general). Así quedan en el tablero «Por resolver»; el backend también puede extraerlas del texto, pero el JSON evita olvidos.

**field_path admitidos (ejemplos)**
- summary — texto del resumen ejecutivo.
- org_member — value: { "name", "role?", "area?", "linkedin?", "notes?" }.
- competencia_partner — value: { "partner_name", "ambitos?" (array: tecnico | funcional | estrategia), "detalle?", "analisis?", "momentum?" (bien | neutro | debil | riesgo: posicionamiento frente al cliente). Añade una fila en la vista «Competencia / partners» del resumen.
- open_question — value: { "topic", "question", "priority?" }. topic debe ser uno de: economics | business_model | customers | tech_stack | critical_processes | sector_context | competencia | org | signals | general.
- economics.* — p. ej. economics.revenue_model, economics.scale, economics.margins_notes.
- business_model.* — p. ej. business_model.value_proposition, business_model.channels.
- customers.* — p. ej. customers.segments, customers.concentration, customers.icp.
- tech_stack.* — p. ej. tech_stack.erp, tech_stack.crm, tech_stack.cloud, tech_stack.dev_tools, tech_stack.integrations, tech_stack.security_notes.
- critical_processes.* — p. ej. critical_processes.order_to_cash, critical_processes.procurement.
- sector_context.* — p. ej. sector_context.regulation, sector_context.competition, sector_context.trends.

Valores: objetos JSON planos cuando puedas; strings si solo hay texto.`;

export function buildResearchPrompt(companyId: string, contextMd: string, historyBlock: string, userMessage: string): { system: string; user: string } {
  const system = `Eres un asistente KYC para la empresa (company_id=${companyId}). Tienes el contexto a continuación en markdown.

Objetivo: enriquecer conocimiento — organigrama, stack tecnológico, economía, modelo de negocio, clientes, procesos, contexto sectorial y señales comerciales.

Herramientas no disponibles (solo texto): razona con el contexto; para lagunas reales propón **open_question** con topic canónico y redacción no duplicada respecto a las ya listadas. Si el interlocutor aporta datos, conviértelos en **field_path** + **value** en el JSON de cierre.

**org_member:** únicamente personas internas de la empresa. Partners tecnológicos, consultoras y actor relevante en cuenta van en **competencia_partner** (nombre, ámbitos, detalle, análisis, momentum); **tech_stack** sigue siendo para sistemas y herramientas. No registres partners como org_member.`;

  const user = `## Contexto
${contextMd}

## Historial
${historyBlock}

## Nuevo mensaje
${userMessage}
${SYNC_FOOTER}`;

  return { system, user };
}

export function buildIntakePrompt(companyId: string, contextMd: string, historyBlock: string, userMessage: string): { system: string; user: string } {
  const system = `Eres un asistente de ENTREVISTA KYC (company_id=${companyId}).

Conduces una conversación guiada en español: una pregunta clara por turno cuando falte información, cubriendo **varios ámbitos** a lo largo del hilo (economía, modelo de negocio, clientes, stack tech, procesos críticos, sector, organigrama).

Reglas:
- Usa el contexto y el historial; no repitas preguntas ya listadas como abiertas ni hagas la misma pregunta con otras palabras.
- **org_member** solo para personas **internas** (dirección, áreas, staff). Partners, consultoras y competidores relevantes en la cuenta van con **competencia_partner** (no como org_member). Stack y herramientas en **tech_stack**; huecos sin dato como **open_question** (topic competencia si aplica).
- Cuando el usuario responda con hechos, en la última línea incluye **KYC_PROPOSED_JSON** con **field_path** hacia el perfil (especialmente tech_stack y el resto de bloques) antes que nuevas open_question.
- Si cierras con **Pendiente(s) para próxima sesión** y una lista de preguntas, duplica cada ítem en KYC_PROPOSED_JSON como **open_question** para que aparezcan en «Por resolver».
- open_question: topic ∈ economics | business_model | customers | tech_stack | critical_processes | sector_context | competencia | org | signals | general.`;

  const user = `## Contexto
${contextMd}

## Historial
${historyBlock}

## Nuevo mensaje
${userMessage}
${SYNC_FOOTER}`;

  return { system, user };
}
