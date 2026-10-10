import type ExcelJS from 'exceljs';
import { IngestionError } from '../ingestion.errors.js';
import type { CellValue } from '../table.js';

type ScalarCellValue = string | number | boolean | Date;
type ObjectCellValue = Exclude<ExcelJS.CellValue, ScalarCellValue | null | undefined>;
type FormulaCellValue = ExcelJS.CellFormulaValue | ExcelJS.CellSharedFormulaValue;

export function readCellValue(cell: ExcelJS.Cell): CellValue {
  const { value } = cell;
  if (value === null || value === undefined) return null;
  if (isScalar(value)) return value;
  return readObjectValue(value, cell);
}

function readObjectValue(value: ObjectCellValue, cell: ExcelJS.Cell): CellValue {
  // Checked before anything text-like: a hyperlink's `text` is its display text and may be rich text.
  if ('hyperlink' in value) return readHyperlinkText(value, cell);
  if (isFormula(value)) return readFormulaResult(cell);
  if ('richText' in value) return joinRichText(value);
  if ('error' in value) throw excelError(`Cell ${location(cell)} contains`, value.error);
  return unsupportedValue(value, cell);
}

function readFormulaResult(cell: ExcelJS.Cell): CellValue {
  const result: unknown = cell.result;
  if (result === undefined || result === null) return null;
  if (isScalar(result)) return result;
  if (isErrorValue(result)) throw excelError(`Formula in ${location(cell)} evaluates to`, result.error);
  throw new IngestionError(`Formula in ${location(cell)} has an unsupported result`);
}

/** Declared as a string, but ExcelJS keeps rich display text as is and leaves missing text undefined. */
function readHyperlinkText(value: ExcelJS.CellHyperlinkValue, cell: ExcelJS.Cell): CellValue {
  const text: unknown = value.text;
  if (text === undefined || text === null) return null;
  if (typeof text === 'string') return text;
  if (isRichText(text)) return joinRichText(text);
  throw new IngestionError(`Hyperlink in ${location(cell)} has unsupported display text`);
}

function joinRichText(value: ExcelJS.CellRichTextValue): string {
  return value.richText.map((part) => part.text).join('');
}

function isScalar(value: unknown): value is ScalarCellValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date;
}

/** Shared-formula cells reference their master's formula and carry no `formula` of their own. */
function isFormula(value: ObjectCellValue): value is FormulaCellValue {
  return 'formula' in value || 'sharedFormula' in value;
}

function isErrorValue(value: unknown): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string';
}

function isRichText(value: unknown): value is ExcelJS.CellRichTextValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'richText' in value &&
    Array.isArray(value.richText) &&
    value.richText.every((part: unknown) => typeof part === 'object' && part !== null && 'text' in part && typeof part.text === 'string')
  );
}

function excelError(prefix: string, code: string): IngestionError {
  return new IngestionError(`${prefix} the Excel error ${code}; fix or clear it in the source file`);
}

/**
 * Compile time: every declared ExcelJS variant must be handled before this call.
 * Runtime: ExcelJS also yields undeclared shapes (e.g. JSON values), reported as user errors.
 */
function unsupportedValue(value: never, cell: ExcelJS.Cell): never {
  const kind = Array.isArray(value) ? 'array' : typeof value;
  throw new IngestionError(`Cell ${location(cell)} has an unsupported value (${kind})`);
}

function location(cell: ExcelJS.Cell): string {
  return `${cell.worksheet.name}!${cell.address}`;
}
