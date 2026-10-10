import { parse } from 'csv-parse/sync';
import { IngestionError } from '../ingestion.errors.js';
import type { CellValue, RawTable } from '../table.js';
import type { FileParser } from './file-parser.js';

const LINE_BREAK = /\r\n|\r|\n/g;

export class CsvParser implements FileParser {
  readonly extensions = ['.csv'] as const;

  async parse(content: Uint8Array): Promise<RawTable[]> {
    const rowsByLine: CellValue[][] = [];
    
    let linesInRecords = 0;
    try {
      parse(Buffer.from(content), {
        bom: true,
        trim: true,
        skip_empty_lines: true,
        on_record: (record, { empty_lines: blankLinesSoFar }) => {
          const firstLine = 1 + linesInRecords + blankLinesSoFar;
          rowsByLine[firstLine - 1] = record.map((cell) => (cell === '' ? null : cell));
          linesInRecords += linesSpannedBy(record);
          return null; // rows are collected above; nothing to accumulate in the parser
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new IngestionError(`Malformed CSV: ${reason}`, undefined, { cause: error });
    }
    // CSV has no cell types: every value is text, typing happens in the mapper.
    return [{ sheet: null, rows: Array.from(rowsByLine, (row) => row ?? []) }];
  }
}

/** A record takes one line, plus one per line break inside its (quoted) values. */
function linesSpannedBy(record: string[]): number {
  let lineBreaks = 0;
  for (const cell of record) lineBreaks += cell.match(LINE_BREAK)?.length ?? 0;
  return 1 + lineBreaks;
}
