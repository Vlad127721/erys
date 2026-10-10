/** A single cell as produced by a file parser, before any interpretation. */
export type CellValue = string | number | boolean | Date | null;

/** A grid of cells exactly as found in the source (header row not yet identified). */
export interface RawTable {
  /** Worksheet name, or `null` for single-table formats such as CSV. */
  sheet: string | null;
  rows: CellValue[][];
}

export interface TableRow {
  /** 1-based row number in the source file, for error messages. */
  rowNumber: number;
  cells: ReadonlyMap<string, CellValue>;
}

/** A table with a known header: column names are unique and non-empty, empty rows removed. */
export interface Table {
  sheet: string | null;
  columns: string[];
  rows: TableRow[];
}
