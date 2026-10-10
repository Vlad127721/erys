import ExcelJS from 'exceljs';
import { IngestionError } from '../ingestion.errors.js';
import type { CellValue, RawTable } from '../table.js';
import type { FileParser } from './file-parser.js';
import { readCellValue } from './xlsx-cell-value.js';

export class XlsxParser implements FileParser {
  readonly extensions = ['.xlsx'] as const;

  async parse(content: Uint8Array): Promise<RawTable[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      // `slice()` yields a standalone ArrayBuffer, which is what ExcelJS declares it accepts.
      await workbook.xlsx.load(content.slice().buffer);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new IngestionError(`Malformed XLSX: ${reason}`, undefined, { cause: error });
    }

    return workbook.worksheets.map((sheet) => {
      const rows: CellValue[][] = [];
      // Includes empty rows so that row indexes match the sheet's row numbers.
      sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const cells: CellValue[] = [];
        for (let col = 1; col <= sheet.columnCount; col++) {
          cells.push(readCellValue(row.getCell(col)));
        }
        rows[rowNumber - 1] = cells;
      });
      return { sheet: sheet.name, rows: Array.from(rows, (row) => row ?? []) };
    });
  }
}
