import { IngestionError } from './ingestion.errors.js';
import type { CellValue, RawTable, Table, TableRow } from './table.js';

/** A source row with its 1-based row number in the file, kept for error messages. */
interface NumberedRow {
  rowNumber: number;
  cells: CellValue[];
}

interface Column {
  index: number;
  name: string;
}

/**
 * Turns a raw grid into a table with a header:
 * 1. the first non-empty row is the header;
 * 2. fully empty rows are dropped (spreadsheets often carry hundreds of formatted but empty rows);
 * 3. columns without a header are dropped if they hold no data, and rejected otherwise;
 * 4. duplicate column names are rejected, since a mapping could not tell them apart.
 */
export function normalizeTable(raw: RawTable): Table {
  const where = raw.sheet ? ` in sheet "${raw.sheet}"` : '';

  const headerIndex = raw.rows.findIndex((cells) => !isEmptyRow(cells));
  if (headerIndex === -1) throw new IngestionError(`No data found${where}`);
  const header = raw.rows[headerIndex]!;

  const dataRows: NumberedRow[] = [];
  for (let index = headerIndex + 1; index < raw.rows.length; index++) {
  const cells = raw.rows[index]!;

  if (isEmptyRow(cells)) continue;

  dataRows.push({
    rowNumber: index + 1,
    cells,
  });
}

  const columns = readColumns(header, dataRows, where);

  const rows: TableRow[] = dataRows.map(({ rowNumber, cells }) => ({
    rowNumber,
    cells: new Map(columns.map(({ index, name }) => [name, normalizeCell(cells[index] ?? null)])),
  }));

  return { sheet: raw.sheet, columns: columns.map((column) => column.name), rows };
}

/** Named, unique columns of the table, in source order. */
function readColumns(header: CellValue[], dataRows: NumberedRow[], where: string): Column[] {
  const columns: Column[] = [];
  const seenNames = new Set<string>();
  const width = tableWidth(header, dataRows);

  for (let index = 0; index < width; index++) {
    const name = headerName(header[index] ?? null);

    if (name === null) {
      const rowWithValue = dataRows.find((row) => !isEmpty(row.cells[index] ?? null));
      if (rowWithValue) {
        throw new IngestionError(`Column ${index + 1}${where} has values (row ${rowWithValue.rowNumber}) but no header`);
      }
      continue;
    }

    if (seenNames.has(name)) throw new IngestionError(`Duplicate column "${name}"${where}`);
    seenNames.add(name);
    columns.push({ index, name });
  }

  if (columns.length === 0) throw new IngestionError(`No columns found${where}`);
  return columns;
}

/** Finds the widest row without spreading a large array into Math.max. */
function tableWidth(header: CellValue[], dataRows: NumberedRow[]): number {
  let width = header.length;
  for (const row of dataRows) width = Math.max(width, row.cells.length);
  return width;
}

function isEmptyRow(cells: CellValue[]): boolean {
  return cells.every(isEmpty);
}

function isEmpty(value: CellValue): boolean {
  return value === null || (typeof value === 'string' && value.trim() === '');
}

/** Header text; dates (Excel date cells used as headers) become their ISO timestamp. */
function headerName(value: CellValue): string | null {
  if (isEmpty(value)) return null;
  return (value instanceof Date ? value.toISOString() : String(value)).trim();
}

/** Trims text and turns blank text into `null`; numbers, booleans and dates pass through unchanged. */
function normalizeCell(value: CellValue): CellValue {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
