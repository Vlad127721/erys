import { describe, expect, it } from 'vitest';
import { normalizeTable } from '../../src/ingestion/normalize.js';
import type { CellValue, Table } from '../../src/ingestion/table.js';

const normalize = (rows: CellValue[][], sheet: string | null = null) => normalizeTable({ sheet, rows });

/** Rows as plain objects, with their source row numbers, for readable expectations. */
const rowsOf = (table: Table) => table.rows.map((row) => ({ row: row.rowNumber, ...Object.fromEntries(row.cells) }));

describe('normalizeTable', () => {
  describe('empty input', () => {
    it.each([
      ['no rows', []],
      ['only empty rows', [[], [null, null], ['', '   ']]],
    ])('rejects a table with %s', (_case, rows) => {
      expect(() => normalize(rows)).toThrow('No data found');
    });

    it('names the sheet in the error', () => {
      expect(() => normalize([[null]], 'Q1')).toThrow('No data found in sheet "Q1"');
    });

    it('accepts a header without data rows', () => {
      expect(normalize([['Brand', 'Value']])).toEqual({ sheet: null, columns: ['Brand', 'Value'], rows: [] });
    });
  });

  describe('header and rows', () => {
    it('uses the first non-empty row as the header, skipping leading empty rows', () => {
      const table = normalize([[], [null, '  '], ['Brand', 'Value'], ['A', 1]]);
      expect(table.columns).toEqual(['Brand', 'Value']);
      expect(rowsOf(table)).toEqual([{ row: 4, Brand: 'A', Value: 1 }]);
    });

    it('drops empty rows but keeps the original row numbers of the others', () => {
      const table = normalize([['Brand', 'Value'], ['A', 1], [], [' ', null], ['B', 2]]);
      expect(rowsOf(table)).toEqual([
        { row: 2, Brand: 'A', Value: 1 },
        { row: 5, Brand: 'B', Value: 2 },
      ]);
    });

    it('fills cells missing from short rows with null', () => {
      expect(rowsOf(normalize([['Brand', 'Value'], ['A']]))).toEqual([{ row: 2, Brand: 'A', Value: null }]);
    });

    it('turns non-text headers into text: numbers, booleans, and dates as ISO timestamps', () => {
      const date = new Date(Date.UTC(2024, 9, 28));
      expect(normalize([[2024, true, date, ' Brand ']]).columns).toEqual([
        '2024',
        'true',
        '2024-10-28T00:00:00.000Z',
        'Brand',
      ]);
    });
  });

  describe('columns', () => {
    it('drops a column without a header when it holds no data (e.g. formatted but empty)', () => {
      const table = normalize([['Brand', null, 'Value', '  '], ['A', null, 1, ''], ['B', ' ', 2]]);
      expect(table.columns).toEqual(['Brand', 'Value']);
      expect(rowsOf(table)).toEqual([
        { row: 2, Brand: 'A', Value: 1 },
        { row: 3, Brand: 'B', Value: 2 },
      ]);
    });

    it('rejects values in a column without a header, naming the column and the first such row', () => {
      expect(() => normalize([['Brand', null], ['A', null], ['B', 7]], 'Q1')).toThrow(
        'Column 2 in sheet "Q1" has values (row 3) but no header',
      );
    });

    it('rejects values past the end of the header row', () => {
      expect(() => normalize([['Brand'], ['A', 'extra']])).toThrow('Column 2 has values (row 2) but no header');
    });

    it('rejects duplicate column names, compared after trimming', () => {
      expect(() => normalize([['Value', 'Brand', ' Value ']], 'Q1')).toThrow('Duplicate column "Value" in sheet "Q1"');
    });
  });

  describe('cell values', () => {
    it('trims text and turns blank text into null, keeping other types as they are', () => {
      const date = new Date(Date.UTC(2025, 0, 6));
      const table = normalize([
        ['Text', 'Blank', 'Spaces', 'Zero', 'False', 'Date', 'Null'],
        ['  a b  ', '', '   ', 0, false, date, null],
      ]);
      expect(rowsOf(table)).toEqual([
        { row: 2, Text: 'a b', Blank: null, Spaces: null, Zero: 0, False: false, Date: date, Null: null },
      ]);
    });
  });

  it('handles large tables (regression: Math.max(...rows) overflowed the stack above ~100k rows)', () => {
    const rows: CellValue[][] = [['Brand', 'Value']];
    for (let i = 0; i < 200_000; i++) rows.push([`B${i}`, i]);

    const table = normalize(rows);

    expect(table.rows).toHaveLength(200_000);
    expect(table.rows.at(-1)?.rowNumber).toBe(200_001);
  });
});
