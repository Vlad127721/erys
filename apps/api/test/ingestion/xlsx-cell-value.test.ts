import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { IngestionError } from '../../src/ingestion/ingestion.errors.js';
import { XlsxParser } from '../../src/ingestion/parsers/xlsx.parser.js';
import { readCellValue } from '../../src/ingestion/parsers/xlsx-cell-value.js';

/** ExcelJS accepts values outside its declared union (JSON, `shareType`); tests need those too. */
function setValue(cell: ExcelJS.Cell, value: unknown): void {
  Reflect.set(cell, 'value', value);
}

/** Reads `value` back through an in-memory cell, as the parser does for loaded files. */
function read(value: unknown): ReturnType<typeof readCellValue> {
  const cell = new ExcelJS.Workbook().addWorksheet('Data').getCell('B2');
  setValue(cell, value);
  return readCellValue(cell);
}

const date = new Date(Date.UTC(2024, 9, 28));

describe('readCellValue', () => {
  it.each([
    ['empty', null, null],
    ['string', 'Brand A', 'Brand A'],
    ['number', 42.5, 42.5],
    ['zero', 0, 0],
    ['boolean', false, false],
    ['date', date, date],
  ])('keeps %s values', (_case, value, expected) => {
    expect(read(value)).toEqual(expected);
  });

  describe('formulas', () => {
    it.each([
      ['number', 7, 7],
      ['zero', 0, 0],
      ['false', false, false],
      ['string', 'ok', 'ok'],
      ['date', date, date],
      ['explicitly empty', '', ''],
    ])('use the cached %s result', (_case, result, expected) => {
      expect(read({ formula: 'X()', result })).toEqual(expected);
    });

    it('treat a missing cached result as an empty cell', () => {
      expect(read({ formula: 'B1*2' })).toBeNull();
    });

    it('read shared-formula cells from their own cached result', () => {
      const sheet = new ExcelJS.Workbook().addWorksheet('Data');
      setValue(sheet.getCell('A1'), { formula: 'ROW()', result: 1, shareType: 'shared', ref: 'A1:A2' });
      sheet.getCell('A2').value = { sharedFormula: 'A1', result: 2 };
      expect(readCellValue(sheet.getCell('A2'))).toBe(2);
    });

    it('reject an Excel error result, naming the cell', () => {
      expect(() => read({ formula: '1/0', result: { error: '#DIV/0!' } })).toThrow(
        new IngestionError('Formula in Data!B2 evaluates to the Excel error #DIV/0!; fix or clear it in the source file'),
      );
    });
  });

  it('rejects Excel error cells, naming the cell', () => {
    expect(() => read({ error: '#N/A' })).toThrow(/^Cell Data!B2 contains the Excel error #N\/A/);
  });

  it('joins rich text runs', () => {
    expect(read({ richText: [{ text: 'Brand ' }, { text: 'A', font: { bold: true } }] })).toBe('Brand A');
  });

  describe('hyperlinks', () => {
    it('use the display text, not the URL', () => {
      expect(read({ text: 'YouScan', hyperlink: 'https://youscan.io' })).toBe('YouScan');
    });

    it('accept rich display text', () => {
      expect(read({ text: { richText: [{ text: 'You' }, { text: 'Scan' }] }, hyperlink: 'https://youscan.io' })).toBe(
        'YouScan',
      );
    });

    it('treat missing display text as empty', () => {
      expect(read({ hyperlink: 'https://youscan.io' })).toBeNull();
    });
  });

  it.each([
    ['object', { some: 'json' }],
    ['array', [1, 2]],
  ])('rejects undeclared %s values with a user-facing error', (kind, value) => {
    expect(() => read(value)).toThrow(new IngestionError(`Cell Data!B2 has an unsupported value (${kind})`));
  });
});

describe('XlsxParser', () => {
  it('reads values from a saved workbook, including falsy formula results', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data');
    sheet.addRow(['Brand', 'Value', 'Flag', 'Pending']);
    sheet.addRow([
      { text: 'A', hyperlink: 'https://a.example' },
      { formula: '1-1', result: 0 },
      { formula: '1=2', result: false },
      { formula: 'B2*2' },
    ]);
    sheet.addRow([{ richText: [{ text: 'B' }] }, { formula: '2+3', result: 5 }, true, null]);

    const [table] = await new XlsxParser().parse(new Uint8Array(await workbook.xlsx.writeBuffer()));

    expect(table).toEqual({
      sheet: 'Data',
      rows: [
        ['Brand', 'Value', 'Flag', 'Pending'],
        ['A', 0, false, null],
        ['B', 5, true, null],
      ],
    });
  });

  it('reports a corrupt file with the original error as the cause', async () => {
    const error = await new XlsxParser().parse(new TextEncoder().encode('not a zip')).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(IngestionError);
    expect((error as IngestionError).message).toMatch(/^Malformed XLSX: /);
    expect((error as IngestionError).cause).toBeInstanceOf(Error);
  });
});
