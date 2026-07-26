import * as XLSX from '@stackline/xlsx';

type Candidate = {
  priority: number;
  marginPercentage: number;
  sheetIndex: number;
  row: number;
  column: number;
};

const MAX_LOOKAHEAD_CELLS = 6;

export function extractPfeMarginPercentageFromBuffer(buffer: Buffer): number | null {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    sheetStubs: true,
  });

  const candidates: Candidate[] = [];

  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const sheet = workbook.Sheets[sheetName];
    const rangeRef = sheet?.['!ref'];
    if (!sheet || !rangeRef) return;

    const range = XLSX.utils.decode_range(rangeRef);
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let column = range.s.c; column <= range.e.c; column += 1) {
        const value = cellValue(sheet, row, column);
        if (typeof value !== 'string') continue;

        const label = normalizeLabel(value);
        if (!label.includes('margin')) continue;
        if (isExcludedMarginLabel(label)) continue;

        const candidate = candidateForLabel(sheet, normalizeLabel(sheetName), label, sheetIndex, row, column);
        if (candidate) candidates.push(candidate);
      }
    }
  });

  candidates.sort(
    (a, b) =>
      a.priority - b.priority ||
      a.sheetIndex - b.sheetIndex ||
      a.row - b.row ||
      a.column - b.column,
  );

  return candidates[0]?.marginPercentage ?? null;
}

function candidateForLabel(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  label: string,
  sheetIndex: number,
  row: number,
  column: number,
): Candidate | null {
  if (label === 'margin') {
    const margin = normalizeMarginValue(cellValue(sheet, row + 1, column));
    const priority = sheetName === 'summary' ? 1 : 3;
    return margin == null ? null : { priority, marginPercentage: margin, sheetIndex, row, column };
  }

  if (label === 'gross margin %') {
    const margin = firstMarginToRight(sheet, row, column);
    return margin == null ? null : { priority: 2, marginPercentage: margin, sheetIndex, row, column };
  }

  if (label === 'gross margin') {
    const margin = grossMarginRowPercentage(sheet, row, column);
    return margin == null ? null : { priority: 4, marginPercentage: margin, sheetIndex, row, column };
  }

  return null;
}

function firstMarginToRight(sheet: XLSX.WorkSheet, row: number, column: number): number | null {
  for (let offset = 1; offset <= MAX_LOOKAHEAD_CELLS; offset += 1) {
    const margin = normalizeMarginValue(cellValue(sheet, row, column + offset));
    if (margin != null) return margin;
  }
  return null;
}

function grossMarginRowPercentage(sheet: XLSX.WorkSheet, row: number, column: number): number | null {
  const numericValues: number[] = [];
  for (let offset = 1; offset <= MAX_LOOKAHEAD_CELLS; offset += 1) {
    const raw = cellValue(sheet, row, column + offset);
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    numericValues.push(raw);
  }

  const secondNumeric = numericValues.at(1);
  const fromSecond = normalizeMarginValue(secondNumeric);
  if (fromSecond != null) return fromSecond;

  for (const raw of numericValues) {
    const margin = normalizeMarginValue(raw);
    if (margin != null) return margin;
  }
  return null;
}

function normalizeMarginValue(raw: unknown): number | null {
  let value: number;
  if (typeof raw === 'number') {
    value = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;
    const normalized = trimmed.replace(/%/g, '').replace(/\s/g, '').replace(',', '.');
    value = Number.parseFloat(normalized);
    if (trimmed.includes('%')) value /= 100;
  } else {
    return null;
  }

  if (!Number.isFinite(value) || value < 0) return null;
  const percentage = Math.abs(value) <= 1 ? value * 100 : value;
  if (percentage < 0 || percentage > 100) return null;
  return Math.round(percentage);
}

function normalizeLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isExcludedMarginLabel(label: string): boolean {
  return (
    label.startsWith('operating margin') ||
    /^margin\s+\d/.test(label) ||
    /^gross margin\s*[\(\[]/.test(label)
  );
}

function cellValue(sheet: XLSX.WorkSheet, row: number, column: number): unknown {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  return sheet[address]?.v;
}

