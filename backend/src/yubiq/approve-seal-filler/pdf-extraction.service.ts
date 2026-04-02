import { BadRequestException, Injectable } from '@nestjs/common';
import * as pdfParseNs from 'pdf-parse';

@Injectable()
export class PdfExtractionService {
  async extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('PDF vacío');
    }
    // pdf-parse v2 expone clase `PDFParse` (no función).
    // https://www.npmjs.com/package/pdf-parse (Getting Started with v2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = pdfParseNs as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PDFParse: any = mod?.PDFParse ?? mod?.default?.PDFParse;
    if (typeof PDFParse !== 'function') {
      throw new BadRequestException('No se pudo inicializar el parser de PDF (PDFParse)');
    }
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return String(result?.text ?? '').trim();
  }
}

