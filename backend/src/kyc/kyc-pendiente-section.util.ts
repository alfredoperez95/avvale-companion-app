import type { ProposedItem } from './kyc-apply-proposed.util';

/** La línea contiene el ancla del bloque (vale con **negritas**, «Temas…», etc.). */
function lineHasPendienteProximaSesionHeader(line: string): boolean {
  return /Pendientes?\s+para\s+(?:la\s+)?pr[oó]xima\s+sesi[oó]n/i.test(line);
}

function isHorizontalRule(line: string): boolean {
  return /^-{3,}\s*$/.test(line.trim()) || /^[*_]{3,}\s*$/.test(line.trim());
}

function isMarkdownHeading(line: string): boolean {
  return /^#{1,4}\s+\S/.test(line.trim());
}

/**
 * Detecta el bloque «…Pendiente(s) para (la) próxima sesión» y convierte cada ítem numerado o con viñeta
 * en propuestas open_question. Tolera líneas en blanco entre ítems y continuaciones de texto en la siguiente línea.
 */
export function proposedOpenQuestionsFromPendienteSection(assistantText: string): ProposedItem[] {
  if (!assistantText) return [];
  const normalized = assistantText.replace(/\r\n/g, '\n');
  const beforeJson = normalized.split(/\nKYC_PROPOSED_JSON:/i)[0] ?? normalized;

  const lines = beforeJson.split('\n');
  let sectionStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lineHasPendienteProximaSesionHeader(lines[i])) {
      sectionStart = i + 1;
      break;
    }
  }
  if (sectionStart === -1) return [];

  const questions: string[] = [];
  let current: string | null = null;

  const flush = () => {
    if (current && current.trim().length > 2) questions.push(current.trim());
    current = null;
  };

  for (let i = sectionStart; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();

    if (isHorizontalRule(t)) {
      flush();
      break;
    }
    if (isMarkdownHeading(t)) {
      flush();
      break;
    }

    const numbered = t.match(/^\d{1,2}[\.\)]\s*(.+)$/);
    if (numbered) {
      flush();
      current = numbered[1].trim();
      continue;
    }

    const bullet = t.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      flush();
      current = bullet[1].trim();
      continue;
    }

    if (!t) {
      continue;
    }

    if (current) {
      current += ' ' + t;
    }
  }
  flush();

  return questions.map(
    (question): ProposedItem => ({
      field_path: 'open_question',
      value: { topic: 'general', question, priority: 2 },
      source: 'intake',
    }),
  );
}
