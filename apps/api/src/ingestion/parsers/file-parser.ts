import type { RawTable } from '../table.js';

/** Turns file bytes into raw tables. One implementation per file format. */
export interface FileParser {
  /** Lower-case extensions including the dot, e.g. [".xlsx"]. */
  readonly extensions: readonly string[];
  parse(content: Uint8Array): Promise<RawTable[]>;
}
