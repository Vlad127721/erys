import {
  assertNever,
  isoDateSchema,
  widgetPayloadSchema,
  type ColumnMapping,
  type ImportTarget,
  type PieChartData,
  type SeriesChartData,
  type WidgetPayload,
} from '@youscan/shared';
import { IngestionError } from './ingestion.errors.js';
import type { CellValue, Table, TableRow } from './table.js';

interface Category {
  label: string;
  isDate: boolean;
}

/**
 * Applies an explicit column mapping to a normalized table and returns a validated widget
 * payload. Any mismatch (unknown column, non-numeric value, duplicate point) is an
 * `IngestionError` that names the offending column and row.
 */
export function mapTableToWidget(table: Table, target: ImportTarget): WidgetPayload {
  requireColumns(table, target.mapping);

  const result = widgetPayloadSchema.safeParse(buildPayload(table, target));
  if (!result.success) {
    throw new IngestionError(`Imported data is not a valid ${target.widgetType} widget`, result.error.issues);
  }
  return result.data;
}

function buildPayload(table: Table, { widgetType, mapping }: ImportTarget): WidgetPayload {
  switch (widgetType) {
    case 'LINE':
      return { type: 'LINE', data: toSeriesData(table, mapping) };
    case 'BAR':
      return { type: 'BAR', data: toSeriesData(table, mapping) };
    case 'STACKED_BAR':
      return { type: 'STACKED_BAR', data: toSeriesData(table, mapping) };
    case 'PIE':
      return { type: 'PIE', data: toPieData(table, mapping) };
    default:
      return assertNever(widgetType);
  }
}

function toSeriesData(table: Table, mapping: ColumnMapping): SeriesChartData {
  switch (mapping.shape) {
    case 'wide':
      return fromWide(table, mapping);
    case 'long':
      return fromLong(table, mapping);
    default:
      return assertNever(mapping);
  }
}

function mappedColumns(mapping: ColumnMapping): string[] {
  switch (mapping.shape) {
    case 'wide':
      return [mapping.category, ...mapping.values];
    case 'long':
      return [mapping.x, mapping.series, mapping.value];
    default:
      return assertNever(mapping);
  }
}

function requireColumns(table: Table, mapping: ColumnMapping): void {
  const wanted = mappedColumns(mapping);
  const missing = wanted.filter((name) => !table.columns.includes(name));
  if (missing.length > 0) {
    const where = table.sheet ? ` in sheet "${table.sheet}"` : '';
    throw new IngestionError(
      `Column(s) ${missing.map((m) => `"${m}"`).join(', ')} not found${where}. Available: ${table.columns.join(', ')}`,
    );
  }
  if (new Set(wanted).size !== wanted.length) {
    throw new IngestionError('A column cannot be used more than once in a mapping');
  }
}

/** One row per category, one value column per series. */
function fromWide(table: Table, mapping: Extract<ColumnMapping, { shape: 'wide' }>): SeriesChartData {
  const points = table.rows.map((row) => ({
    category: readCategory(row, mapping.category),
    values: mapping.values.map((column) => readNumber(row, column)),
  }));
  assertUniqueCategories(points.map((p) => p.category.label));

  const ordered = orderCategories(points.map((p) => p.category));
  const byLabel = new Map(points.map((p) => [p.category.label, p.values]));

  return {
    xAxis: ordered.xAxis,
    categories: ordered.labels,
    series: mapping.values.map((name, i) => ({
      name,
      values: ordered.labels.map((label) => byLabel.get(label)![i]!),
    })),
  };
}

/** One row per (category, series) pair; pivoted so that missing pairs become `null` gaps. */
function fromLong(table: Table, mapping: Extract<ColumnMapping, { shape: 'long' }>): SeriesChartData {
  const categories = new Map<string, Category>();
  const seriesNames: string[] = [];
  const values = new Map<string, Map<string, number | null>>();

  for (const row of table.rows) {
    const category = readCategory(row, mapping.x);
    const series = readCategory(row, mapping.series).label;
    const value = readNumber(row, mapping.value);

    if (!categories.has(category.label)) categories.set(category.label, category);
    let seriesValues = values.get(series);
    if (!seriesValues) {
      seriesValues = new Map();
      values.set(series, seriesValues);
      seriesNames.push(series);
    }
    if (seriesValues.has(category.label)) {
      throw new IngestionError(
        `Duplicate value for "${series}" at "${category.label}" (row ${row.rowNumber}); each pair must appear once`,
      );
    }
    seriesValues.set(category.label, value);
  }

  const ordered = orderCategories([...categories.values()]);
  return {
    xAxis: ordered.xAxis,
    categories: ordered.labels,
    series: seriesNames.map((name) => ({
      name,
      values: ordered.labels.map((label) => values.get(name)!.get(label) ?? null),
    })),
  };
}

function toPieData(table: Table, mapping: ColumnMapping): PieChartData {
  switch (mapping.shape) {
    case 'wide':
      return toPieSlices(table, mapping);
    case 'long':
      throw new IngestionError('A PIE widget needs a "wide" mapping with exactly one value column');
    default:
      return assertNever(mapping);
  }
}

function toPieSlices(table: Table, mapping: Extract<ColumnMapping, { shape: 'wide' }>): PieChartData {
  const [valueColumn, ...extraColumns] = mapping.values;
  if (valueColumn === undefined || extraColumns.length > 0) {
    throw new IngestionError('A PIE widget needs a "wide" mapping with exactly one value column');
  }
  const slices = table.rows.map((row) => {
    const value = readNumber(row, valueColumn);
    if (value === null) throw new IngestionError(`Missing "${valueColumn}" value at row ${row.rowNumber}`);
    return { name: readCategory(row, mapping.category).label, value };
  });
  assertUniqueCategories(slices.map((s) => s.name));
  return { slices };
}

/** Dates sort chronologically; other categories keep their order from the file. */
function orderCategories(categories: Category[]): { xAxis: 'date' | 'category'; labels: string[] } {
  const labels = categories.map((c) => c.label);
  if (categories.length > 0 && categories.every((c) => c.isDate)) {
    // ISO dates: lexicographic order is chronological order.
    return { xAxis: 'date', labels: labels.sort() };
  }
  return { xAxis: 'category', labels };
}

function assertUniqueCategories(labels: string[]): void {
  const seen = new Set<string>();
  for (const label of labels) {
    if (seen.has(label)) throw new IngestionError(`Duplicate category "${label}"`);
    seen.add(label);
  }
}

function readCategory(row: TableRow, column: string): Category {
  const value = cell(row, column);
  if (value === null) throw new IngestionError(`Empty "${column}" at row ${row.rowNumber}`);
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new IngestionError(`Invalid date in "${column}" at row ${row.rowNumber}`);
    return { label: value.toISOString().slice(0, 10), isDate: true };
  }
  const label = String(value);
  return { label, isDate: isoDateSchema.safeParse(label).success };
}

const NUMERIC = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/** Empty cells are gaps (`null`), never zero. */
function readNumber(row: TableRow, column: string): number | null {
  const value = cell(row, column);
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && NUMERIC.test(value)) return Number(value);
  throw new IngestionError(`"${column}" at row ${row.rowNumber} is not a number: ${JSON.stringify(value)}`);
}

function cell(row: TableRow, column: string): CellValue {
  return row.cells.get(column) ?? null;
}
