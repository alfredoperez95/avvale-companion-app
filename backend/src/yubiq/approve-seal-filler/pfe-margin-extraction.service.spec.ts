import * as XLSX from '@stackline/xlsx';
import { describe, expect, it } from 'vitest';
import { PfeMarginExtractionService } from './pfe-margin-extraction.service';

describe('PfeMarginExtractionService', () => {
  const service = new PfeMarginExtractionService();

  it('extrae el margen desde Summary Margin debajo del label', async () => {
    const buffer = workbookBuffer([
      {
        name: 'Service',
        rows: [
          ['Gross Margin %', 0.07],
        ],
      },
      {
        name: 'Summary',
        rows: [
          ['Revenue', 'Costs', 'Margin'],
          [162_900, 129_132.5, 0.20728974831184777],
        ],
      },
    ]);

    await expect(service.extractMarginPercentageFromBuffer(buffer)).resolves.toBe(21);
  });

  it('extrae Gross Margin cuando el porcentaje está tras el importe', async () => {
    const buffer = workbookBuffer([
      {
        name: 'PFE - Step 2 (sales)',
        rows: [
          ['Label', 'Amount', 'Percent'],
          ['Gross Margin', 2858.72, 0.20566330935251795],
          ['Operating Margin', 773.72, 0.05566330935251794],
        ],
      },
    ]);

    await expect(service.extractMarginPercentageFromBuffer(buffer)).resolves.toBe(21);
  });

  it('ignora márgenes secundarios y devuelve null si no hay Gross/Summary válido', async () => {
    const buffer = workbookBuffer([
      {
        name: 'PFE - Step 2 (sales)',
        rows: [
          ['Margin 1', 2858.72, 0.20566330935251795],
          ['Margin 2', 2858.72, 0.20566330935251795],
          ['Operating Margin', 773.72, 0.05566330935251794],
          ['Gross Margin (€)', 33767.5],
        ],
      },
    ]);

    await expect(service.extractMarginPercentageFromBuffer(buffer)).resolves.toBeNull();
  });
});

function workbookBuffer(sheets: Array<{ name: string; rows: unknown[][] }>): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  }
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}

