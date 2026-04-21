/** Une el texto libre del deal con el markdown extraído de adjuntos para el prompt de IA. */
export function buildCombinedDealContextForPrompt(
  manual: string | null | undefined,
  attachments: { fileName: string; extractedMarkdown: string }[],
): string {
  const parts: string[] = [];
  if (manual?.trim()) {
    parts.push('### Texto libre (contexto)\n\n' + manual.trim());
  }
  if (attachments.length > 0) {
    const blocks = attachments.map((a) => {
      const md = a.extractedMarkdown?.trim() ?? '';
      return `### Adjunto: ${a.fileName}\n\n${md}`;
    });
    parts.push('## Material de soporte (contenido extraído de archivos, en Markdown)\n\n' + blocks.join('\n\n---\n\n'));
  }
  if (parts.length === 0) return '';
  return parts.join('\n\n');
}

const MAX_VOICE_CONTEXT_BLOCK_CHARS = 16_000;

/**
 * Texto para `additionalContext` del análisis MEDDPICC: última llamada ConvAI (resumen, data collection, transcripción).
 * Vacío si no hay `notes.convaiLastCall` con contenido útil.
 */
export function buildVoiceSessionContextForPrompt(notes: Record<string, unknown>): string {
  const last = notes.convaiLastCall;
  if (!last || typeof last !== 'object' || Array.isArray(last)) return '';
  const o = last as Record<string, unknown>;
  const summary = typeof o.summary === 'string' ? o.summary.trim() : '';
  const md = typeof o.transcriptMarkdown === 'string' ? o.transcriptMarkdown.trim() : '';
  const dc = o.dataCollectionResults;
  let dcStr = '';
  if (dc != null && typeof dc === 'object' && !Array.isArray(dc)) {
    try {
      dcStr = JSON.stringify(dc, null, 2);
    } catch {
      dcStr = '';
    }
  }
  if (!summary && !md && !dcStr) return '';

  const parts: string[] = [];
  parts.push('### Evidencia de la última sesión de voz (ElevenLabs ConvAI)');
  parts.push(
    'Usa esta información como fuente adicional junto con las respuestas MEDDPICC y el contexto escrito. ' +
      'Si algo contradice el contexto previo, prioriza lo más reciente dicho por el usuario en la llamada.',
  );
  if (typeof o.receivedAt === 'string' && o.receivedAt.trim()) {
    parts.push(`- Recibido: ${o.receivedAt.trim()}`);
  }
  if (typeof o.conversationId === 'string' && o.conversationId.trim()) {
    parts.push(`- Id. conversación: ${o.conversationId.trim()}`);
  }
  if (typeof o.durationSecs === 'number' && Number.isFinite(o.durationSecs)) {
    parts.push(`- Duración (s): ${o.durationSecs}`);
  }
  if (summary) {
    parts.push(`\n**Resumen (post-llamada):**\n${summary}`);
  }
  if (dcStr) {
    const clipped = dcStr.length > 6000 ? `${dcStr.slice(0, 6000)}\n…[recortado]` : dcStr;
    parts.push(`\n**Datos estructurados (data collection):**\n\`\`\`json\n${clipped}\n\`\`\``);
  }
  if (md) {
    let t = md;
    if (t.length > 10_000) {
      t = `${t.slice(0, 10_000)}\n\n…[transcripción recortada]`;
    }
    parts.push(`\n**Transcripción:**\n${t}`);
  }

  let out = parts.join('\n');
  if (out.length > MAX_VOICE_CONTEXT_BLOCK_CHARS) {
    out = `${out.slice(0, MAX_VOICE_CONTEXT_BLOCK_CHARS)}\n\n…[bloque de voz recortado por tamaño]`;
  }
  return out;
}
