import { BadRequestException, Injectable } from '@nestjs/common';
import { PdfExtractionService } from '../yubiq/approve-seal-filler/pdf-extraction.service';
import {
  extractTextFromSpreadsheetBuffer,
  isSpreadsheetOfficeMime,
  looksLikeSpreadsheetFileName,
} from '../rfq-analysis/rfq-spreadsheet-text';
import { extractDocxToMarkdown, extractEmlToMarkdown } from './meddpicc-document-text';

const MAX_MARKDOWN_CHARS = 300_000;

function truncateMd(s: string): string {
  const t = s.trim();
  if (t.length <= MAX_MARKDOWN_CHARS) return t;
  return `${t.slice(0, MAX_MARKDOWN_CHARS)}\n\n… *[contenido truncado por tamaño]*`;
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
      const text = await extractTextFromSpreadsheetBuffer(buffer);
      return truncateMd(text);
    }

    if (
      mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      name.endsWith('.docx')
    ) {
      return truncateMd(await extractDocxToMarkdown(buffer));
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
      return truncateMd(await extractEmlToMarkdown(buffer));
    }

    throw new BadRequestException(
      `Tipo de archivo no soportado (${mimeType || 'desconocido'}). Usa PDF, Excel (.xlsx/.xls), Word (.docx) o correo .eml.`,
    );
  }
}
