import * as fs from 'fs';
import * as pdfParseNs from 'pdf-parse';

type PdfWorkerRequest = {
  filePath: string;
  maxChars: number;
};

process.on('message', async (message: PdfWorkerRequest) => {
  try {
    if (!message?.filePath || typeof message.filePath !== 'string') {
      throw new Error('Ruta de PDF no válida');
    }
    const maxChars = Math.max(1, Math.min(Number(message.maxChars) || 1_000_000, 1_000_000));
    const buffer = fs.readFileSync(message.filePath);
    const text = await extractTextFromPdfBuffer(buffer, maxChars);
    process.send?.({ ok: true, text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.send?.({ ok: false, error: message });
  } finally {
    process.exit(0);
  }
});

async function extractTextFromPdfBuffer(buffer: Buffer, maxChars: number): Promise<string> {
  // pdf-parse v2 expone clase `PDFParse` (no función).
  // https://www.npmjs.com/package/pdf-parse (Getting Started with v2)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = pdfParseNs as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PDFParse: any = mod?.PDFParse ?? mod?.default?.PDFParse;
  if (typeof PDFParse !== 'function') {
    throw new Error('No se pudo inicializar el parser de PDF (PDFParse)');
  }

  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const text = String(result?.text ?? '').trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n… [contenido truncado por tamaño]`;
}
