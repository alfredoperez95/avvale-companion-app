/**
 * Contexto para ElevenLabs ConvAI (`dynamic-variables` en el widget).
 *
 * Variables string que envía la companion (definirlas en el agente ElevenLabs como "Dynamic variables"):
 * - `deal_id` — UUID del deal (para webhooks / APIs).
 * - `nombre_deal` — Nombre de la oportunidad.
 * - `cliente` — Empresa / cliente.
 * - `importe_deal` — Valor en € formateado (es-ES) o "No indicado".
 * - `propietario_nombre` — Solo primer nombre (o primer token) del propietario del deal.
 * - `contexto_deal` — Texto libre de contexto (recortado si es muy largo).
 * - `meddpicc_respondido` — Bloque con preguntas guía ya contestadas (no re-interrogar).
 * - `meddpicc_pendiente` — Lista explícita de huecos MEDDPICC sin respuesta (priorizar la sesión aquí).
 *
 * En el system prompt / primera instrucción del agente, referencia con dobles llaves, p. ej. {{cliente}}.
 */
import { formatEuroDigitsForDisplay } from '@/lib/euro-deal-value';
import { MEDDPICC_DIMENSIONS } from '@/lib/meddpicc-dimensions';

export type ConvaiDealOwner = { name: string | null; lastName: string | null } | null | undefined;

/** Solo el nombre de pila / primer token del propietario (sin apellidos ni email). */
export function ownerFirstNameOnly(owner: ConvaiDealOwner): string {
  if (!owner) return '';
  const n = (owner.name ?? '').trim();
  if (n) return (n.split(/\s+/)[0] ?? n).trim();
  const ln = (owner.lastName ?? '').trim();
  if (ln) return (ln.split(/\s+/)[0] ?? ln).trim();
  return '';
}

const DEFAULT_MAX_CONTEXT = 8000;
const DEFAULT_MAX_BLOCK = 12000;

export function buildMeddpiccConvaiDynamicPayload(params: {
  dealId: string;
  dealName: string;
  company: string;
  valueEuroDigits: string;
  context: string;
  owner: ConvaiDealOwner;
  answers: Record<string, string>;
  maxContextChars?: number;
  maxListChars?: number;
}): Record<string, string> {
  const maxCtx = params.maxContextChars ?? DEFAULT_MAX_CONTEXT;
  const maxList = params.maxListChars ?? DEFAULT_MAX_BLOCK;
  let ctx = (params.context ?? '').trim();
  if (ctx.length > maxCtx) {
    ctx = `${ctx.slice(0, maxCtx)}\n…[contexto recortado por tamaño]`;
  }

  const resolvedChunks: string[] = [];
  const pendingLines: string[] = [];

  for (const dim of MEDDPICC_DIMENSIONS) {
    for (const q of dim.questions) {
      const ans = String(params.answers[q.id] ?? '').trim();
      const header = `[${dim.key}] ${dim.name} — ${q.q}`;
      if (ans) {
        resolvedChunks.push(`${header}\n→ ${ans}`);
      } else {
        pendingLines.push(`• ${q.id} (${dim.name}): ${q.q}`);
      }
    }
  }

  let meddpiccRespondido =
    resolvedChunks.length > 0
      ? resolvedChunks.join('\n\n')
      : '(Aún no hay respuestas rellenadas en las preguntas guía MEDDPICC.)';
  let meddpiccPendiente =
    pendingLines.length > 0
      ? `Solo debes indagar y ayudar a cerrar estos huecos (no repitas como interrogatorio lo ya resuelto arriba):\n${pendingLines.join('\n')}`
      : '(Todas las preguntas guía MEDDPICC tienen texto; puedes repasar coherencia o próximos pasos.)';

  if (meddpiccRespondido.length > maxList) {
    meddpiccRespondido = `${meddpiccRespondido.slice(0, maxList)}\n…[recortado]`;
  }
  if (meddpiccPendiente.length > maxList) {
    meddpiccPendiente = `${meddpiccPendiente.slice(0, maxList)}\n…[recortado]`;
  }

  const importe = formatEuroDigitsForDisplay(params.valueEuroDigits).trim();

  return {
    deal_id: params.dealId,
    nombre_deal: params.dealName.trim(),
    cliente: params.company.trim(),
    importe_deal: importe || 'No indicado',
    propietario_nombre: ownerFirstNameOnly(params.owner),
    contexto_deal: ctx || '(Sin contexto libre en el deal.)',
    meddpicc_respondido: meddpiccRespondido,
    meddpicc_pendiente: meddpiccPendiente,
  };
}

export function buildConvaiFirstMessageSpanish(params: {
  clienteONombreDeal: string;
  pendingCount: number;
}): string {
  const label = params.clienteONombreDeal || 'este deal';
  if (params.pendingCount <= 0) {
    return `Hola. Ya tengo cargado el contexto de ${label} y las respuestas MEDDPICC están completas en la app. ¿Repasamos prioridades o el siguiente paso comercial?`;
  }
  return `Hola. Tengo el cliente, el importe, el propietario y lo que ya está contestado en MEDDPICC. Centrémonos solo en lo que falta: ${params.pendingCount} frentes sin resolver. ¿Por dónde quieres empezar?`;
}
