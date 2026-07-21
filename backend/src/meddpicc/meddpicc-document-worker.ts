import * as fs from 'fs';
import { simpleParser } from 'mailparser';
import mammoth from 'mammoth';

type DocumentWorkerRequest = {
  filePath: string;
  kind: 'docx' | 'eml';
  maxChars: number;
};

process.on('message', async (message: DocumentWorkerRequest) => {
  try {
    if (!message?.filePath || typeof message.filePath !== 'string') {
      throw new Error('Ruta de documento no válida');
    }
    const maxChars = Math.max(1, Math.min(Number(message.maxChars) || 300_000, 300_000));
    const buffer = fs.readFileSync(message.filePath);
    const markdown =
      message.kind === 'docx'
        ? await extractDocxToMarkdown(buffer)
        : message.kind === 'eml'
          ? await extractEmlToMarkdown(buffer)
          : (() => {
              throw new Error('Tipo de documento no soportado');
            })();

    process.send?.({ ok: true, markdown: truncateMarkdown(markdown, maxChars) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.send?.({ ok: false, error: message });
  } finally {
    process.exit(0);
  }
});

async function extractDocxToMarkdown(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  const warnings = result.messages?.map((m: { message: string }) => m.message).join('; ');
  let md = String(result.value ?? '').trim();
  if (!md) md = '(sin texto extraíble)';
  md = md
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n\n');
  if (warnings) md += `\n\n<!-- mammoth: ${warnings} -->`;
  return md;
}

async function extractEmlToMarkdown(buffer: Buffer): Promise<string> {
  const parsed = await simpleParser(buffer);
  const subj = parsed.subject ? `**Asunto:** ${parsed.subject}\n\n` : '';
  const from = parsed.from?.text ? `**De:** ${parsed.from.text}\n\n` : '';
  let body = parsed.text?.trim();
  if (!body && parsed.html) {
    body = stripHtmlBasic(String(parsed.html));
  }
  if (!body) body = '(sin cuerpo de texto reconocible)';
  return `${subj}${from}${body}`;
}

function stripHtmlBasic(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateMarkdown(markdown: string, maxChars: number): string {
  const text = markdown.trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n… *[contenido truncado por tamaño]*`;
}
