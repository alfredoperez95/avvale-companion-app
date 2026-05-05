import DOMPurify from 'dompurify';

/** Oculta la línea de sincronización interna (no debe verse en el chat). */
export function stripKycProposedJsonFromChatText(text: string): string {
  if (!text) return '';
  const marker = 'KYC_PROPOSED_JSON:';
  const idx = text.indexOf(marker);
  if (idx === -1) return text.trimEnd();
  return text.slice(0, idx).trimEnd();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Negrita, cursiva, código inline; el texto ya está escapado HTML. */
function inlineFormat(escapedLine: string): string {
  return escapedLine
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\b_([^_\s][^_]*[^_\s])_\b/g, '<em>$1</em>');
}

/**
 * Convierte markdown ligero del asistente a HTML seguro (párrafos, listas, títulos).
 */
export function formatKycAssistantMessageHtml(raw: string): string {
  const text = stripKycProposedJsonFromChatText(raw);
  if (!text.trim()) return '';

  const lines = text.split('\n');
  const parts: string[] = [];
  let inUl = false;

  const closeUl = () => {
    if (inUl) {
      parts.push('</ul>');
      inUl = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const h2 = trimmed.match(/^##\s+(.+)$/);
    const h3 = trimmed.match(/^###\s+(.+)$/);
    const ul = trimmed.match(/^[-*]\s+(.+)$/);

    if (h2) {
      closeUl();
      parts.push(`<h2>${inlineFormat(escapeHtml(h2[1]))}</h2>`);
      continue;
    }
    if (h3) {
      closeUl();
      parts.push(`<h3>${inlineFormat(escapeHtml(h3[1]))}</h3>`);
      continue;
    }
    if (ul) {
      if (!inUl) {
        parts.push('<ul>');
        inUl = true;
      }
      parts.push(`<li>${inlineFormat(escapeHtml(ul[1]))}</li>`);
      continue;
    }

    closeUl();

    if (trimmed === '') {
      continue;
    }

    const ol = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (ol) {
      parts.push(`<p><strong>${escapeHtml(ol[1])}.</strong> ${inlineFormat(escapeHtml(ol[2]))}</p>`);
      continue;
    }

    parts.push(`<p>${inlineFormat(escapeHtml(line))}</p>`);
  }

  closeUl();

  return DOMPurify.sanitize(parts.join(''), {
    ALLOWED_TAGS: ['p', 'ul', 'li', 'h2', 'h3', 'strong', 'em', 'code'],
  });
}
