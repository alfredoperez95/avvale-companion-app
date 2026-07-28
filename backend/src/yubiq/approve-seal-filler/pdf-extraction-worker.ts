import * as fs from 'fs';
import * as path from 'path';
import * as pdfParseNs from 'pdf-parse';

type PdfWorkerRequest = {
  filePath: string;
  maxChars: number;
  mode?: 'text' | 'screenshots';
  screenshotScale?: number;
  maxPages?: number;
  outputDir?: string;
};

process.on('message', async (message: PdfWorkerRequest) => {
  try {
    if (!message?.filePath || typeof message.filePath !== 'string') {
      throw new Error('Ruta de PDF no válida');
    }
    const mode = message.mode === 'screenshots' ? 'screenshots' : 'text';
    if (mode === 'screenshots') {
      if (!message.outputDir || typeof message.outputDir !== 'string') {
        throw new Error('Directorio de salida de capturas no válido');
      }
      const pages = await renderPdfScreenshots({
        filePath: message.filePath,
        outputDir: message.outputDir,
        scale: Number(message.screenshotScale) || 1,
        maxPages: Number(message.maxPages) || 10,
      });
      await sendToParent({ ok: true, pages });
      return;
    }

    const maxChars = Math.max(1, Math.min(Number(message.maxChars) || 1_000_000, 1_000_000));
    const buffer = fs.readFileSync(message.filePath);
    const text = await extractTextFromPdfBuffer(buffer, maxChars);
    await sendToParent({ ok: true, text });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await sendToParent({ ok: false, error }).catch(() => undefined);
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
  try {
    const result = await parser.getText();
    const text = String(result?.text ?? '').trim();
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}\n… [contenido truncado por tamaño]`;
  } finally {
    try {
      await parser.destroy?.();
    } catch {
      // ignore
    }
  }
}

async function renderPdfScreenshots(params: {
  filePath: string;
  outputDir: string;
  scale: number;
  maxPages: number;
}): Promise<{ pageNumber: number; fileName: string }[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = pdfParseNs as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PDFParse: any = mod?.PDFParse ?? mod?.default?.PDFParse;
  if (typeof PDFParse !== 'function') {
    throw new Error('No se pudo inicializar el parser de PDF (PDFParse)');
  }

  const buffer = fs.readFileSync(params.filePath);
  const parser = new PDFParse({ data: buffer });
  try {
    const scale = Math.min(2, Math.max(0.5, params.scale));
    const maxPages = Math.min(20, Math.max(1, Math.floor(params.maxPages)));
    const result = await parser.getScreenshot({ scale, imageDataUrl: false });
    const pages = Array.isArray(result?.pages) ? result.pages : [];
    if (!pages.length) {
      throw new Error('El PDF no tiene páginas renderizables');
    }

    const out: { pageNumber: number; fileName: string }[] = [];
    for (const page of pages.slice(0, maxPages)) {
      const pageNumber = Number(page?.pageNumber) || out.length + 1;
      const data = page?.data;
      if (!data) continue;
      const fileName = `page-${String(pageNumber).padStart(3, '0')}.png`;
      fs.writeFileSync(path.join(params.outputDir, fileName), Buffer.from(data));
      out.push({ pageNumber, fileName });
    }
    if (!out.length) {
      throw new Error('No se pudieron generar capturas del PDF');
    }
    return out;
  } finally {
    try {
      await parser.destroy?.();
    } catch {
      // ignore
    }
  }
}

function sendToParent(
  payload:
    | { ok: true; text: string }
    | { ok: true; pages: { pageNumber: number; fileName: string }[] }
    | { ok: false; error: string },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process.send) {
      reject(new Error('Canal IPC no disponible'));
      return;
    }
    process.send(payload, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
