import * as XLSX from 'xlsx';

/** Límite aproximado de caracteres extraídos por fichero (evita cargas enormes en contexto). */
const MAX_SPREADSHEET_OUTPUT_CHARS = 500_000;

/**
 * Extrae texto plano desde Excel .xlsx / .xls (hojas como CSV).
 */
export function extractTextFromSpreadsheetBuffer(buf: Buffer): string {
  const wb = XLSX.read(buf, {
    type: 'buffer',
    cellDates: true,
    sheetStubs: true,
  });
  const parts: string[] = [];
  let total = 0;
  for (const sheetName of wb.SheetNames) {
    if (total >= MAX_SPREADSHEET_OUTPUT_CHARS) break;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const header = `\n## Hoja: ${sheetName}\n`;
    const csv = XLSX.utils.sheet_to_csv(ws);
    const block = header + csv;
    const remaining = MAX_SPREADSHEET_OUTPUT_CHARS - total;
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

export function isSpreadsheetOfficeMime(mimeType: string): boolean {
  const mt = (mimeType || '').toLowerCase();
  return (
    mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mt === 'application/vnd.ms-excel' ||
    mt.includes('spreadsheetml')
  );
}

/** Si el MIME viene genérico, la extensión permite tratar el buffer como Excel. */
export function looksLikeSpreadsheetFileName(fileName: string | null | undefined): boolean {
  if (!fileName) return false;
  const n = fileName.toLowerCase();
  return n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.xlsm');
}
