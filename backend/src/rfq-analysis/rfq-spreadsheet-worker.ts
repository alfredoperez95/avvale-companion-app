import * as fs from 'fs';
import * as XLSX from '@stackline/xlsx';

type SpreadsheetWorkerRequest = {
  filePath: string;
  maxChars: number;
};

process.on('message', (message: SpreadsheetWorkerRequest) => {
  try {
    if (!message?.filePath || typeof message.filePath !== 'string') {
      throw new Error('Ruta de Excel no válida');
    }
    const maxChars = Math.max(1, Math.min(Number(message.maxChars) || 500_000, 500_000));
    const buffer = fs.readFileSync(message.filePath);
    const text = extractTextFromSpreadsheetBuffer(buffer, maxChars);
    process.send?.({ ok: true, text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.send?.({ ok: false, error: message });
  } finally {
    process.exit(0);
  }
});

function extractTextFromSpreadsheetBuffer(buf: Buffer, maxChars: number): string {
  const wb = XLSX.read(buf, {
    type: 'buffer',
    cellDates: true,
    sheetStubs: true,
  });
  const parts: string[] = [];
  let total = 0;

  for (const sheetName of wb.SheetNames) {
    if (total >= maxChars) break;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const header = `\n## Hoja: ${sheetName}\n`;
    const csv = XLSX.utils.sheet_to_csv(ws);
    const block = header + csv;
    const remaining = maxChars - total;

    if (block.length <= remaining) {
      parts.push(block);
      total += block.length;
    } else {
      parts.push(block.slice(0, remaining) + '\n… [contenido truncado por tamaño]');
      break;
    }
  }

  return parts.join('\n').trim();
}
