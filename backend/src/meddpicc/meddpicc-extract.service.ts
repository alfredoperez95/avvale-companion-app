import { BadRequestException, Injectable } from '@nestjs/common';
import { simpleParser } from 'mailparser';
import mammoth from 'mammoth';
import { PdfExtractionService } from '../yubiq/approve-seal-filler/pdf-extraction.service';
import {
  extractTextFromSpreadsheetBuffer,
  isSpreadsheetOfficeMime,
  looksLikeSpreadsheetFileName,
} from '../rfq-analysis/rfq-spreadsheet-text';

const MAX_MARKDOWN_CHARS = 300_000;

function truncateMd(s: string): string {
  const t = s.trim();
  if (t.length <= MAX_MARKDOWN_CHARS) return t;
  return `${t.slice(0, MAX_MARKDOWN_CHARS)}\n\n… *[contenido truncado por tamaño]*`;
}

function stripHtmlBasic(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class MeddpiccExtractService {
  constructor(private readonly pdf: PdfExtractionService) {}

  /**
   * Extrae contenido como markdown o texto plano estructurado en markdown.
   */
  async extractToMarkdown(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const name = (fileName || '').toLowerCase();
    const mt = (mimeType || '').toLowerCase();

    if (mt === 'application/pdf' || name.endsWith('.pdf')) {
      const text = await this.pdf.extractTextFromPdfBuffer(buffer);
      return truncateMd(`\n\n${text}\n\n`);
    }

    if (isSpreadsheetOfficeMime(mt) || looksLikeSpreadsheetFileName(fileName)) {
      const text = extractTextFromSpreadsheetBuffer(buffer);
      return truncateMd(text);
    }

    if (
      mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      name.endsWith('.docx')
    ) {
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
      return truncateMd(md);
    }

    if (mt === 'application/msword' || name.endsWith('.doc')) {
      throw new BadRequestException(
        'El formato .doc (Word antiguo) no está soportado. Exporta el documento a .docx o PDF y vuelve a subirlo.',
      );
    }

    if (
      mt === 'message/rfc822' ||
      mt === 'application/vnd.ms-outlook' ||
      name.endsWith('.eml')
    ) {
      const parsed = await simpleParser(buffer);
      const subj = parsed.subject ? `**Asunto:** ${parsed.subject}\n\n` : '';
      const from = parsed.from?.text ? `**De:** ${parsed.from.text}\n\n` : '';
      let body = parsed.text?.trim();
      if (!body && parsed.html) {
        body = stripHtmlBasic(String(parsed.html));
      }
      if (!body) body = '(sin cuerpo de texto reconocible)';
      return truncateMd(`${subj}${from}${body}`);
    }

    throw new BadRequestException(
      `Tipo de archivo no soportado (${mimeType || 'desconocido'}). Usa PDF, Excel (.xlsx/.xls), Word (.docx) o correo .eml.`,
    );
  }
}
