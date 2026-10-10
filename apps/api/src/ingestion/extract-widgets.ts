import type { ImportTarget, WidgetPayload } from '@youscan/shared';
import { IngestionError } from './ingestion.errors.js';
import { mapTableToWidget } from './map-to-widget.js';
import { normalizeTable } from './normalize.js';
import type { ParserRegistry } from './parsers/parser-registry.js';
import type { RawTable } from './table.js';

export interface SourceFile {
  name: string;
  content: Uint8Array;
}

export interface ExtractedWidget {
  title: string;
  payload: WidgetPayload;
}

/**
 * parse → pick sheet → normalize → map → validate, for every target. Pure: nothing is
 * persisted, so a failure in any target leaves no trace.
 */
export async function extractWidgets(
  parsers: ParserRegistry,
  file: SourceFile,
  targets: readonly ImportTarget[],
): Promise<ExtractedWidget[]> {
  const tables = await parsers.forFile(file.name).parse(file.content);
  return targets.map((target) => {
    try {
      const table = normalizeTable(selectTable(tables, target.sheet));
      return { title: target.title, payload: mapTableToWidget(table, target) };
    } catch (error) {
      if (error instanceof IngestionError) {
        throw new IngestionError(`${file.name} → "${target.title}": ${error.message}`, error.details, { cause: error });
      }
      throw error;
    }
  });
}

function selectTable(tables: RawTable[], sheet: string | undefined): RawTable {
  const names = tables.map((t) => t.sheet).filter((name) => name !== null);
  if (sheet === undefined) {
    if (tables.length === 1) return tables[0]!;
    throw new IngestionError(`File has several sheets; specify one of: ${names.join(', ')}`);
  }
  if (names.length === 0) throw new IngestionError(`This file format has no sheets, remove "sheet": "${sheet}"`);
  const table = tables.find((t) => t.sheet === sheet);
  if (!table) throw new IngestionError(`Sheet "${sheet}" not found. Available: ${names.join(', ')}`);
  return table;
}
