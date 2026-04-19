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
