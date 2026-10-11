import { z } from 'zod';
import { CHART_WIDGET_TYPES, widgetTitleSchema } from './widget.js';

const columnName = z.string().trim().min(1);

/**
 * How table columns become chart data. Always explicit: the importer never guesses
 * which columns to use.
 *
 * - `wide`: one row per category, one column per series.
 *   `Brand,Positive,Neutral,Negative` → categories = brands, series = sentiments.
 * - `long`: one row per (category, series) pair.
 *   `Date,Campaign,Result` → categories = dates, series = campaigns, pivoted.
 */
export const columnMappingSchema = z.discriminatedUnion('shape', [
  z
    .object({
      shape: z.literal('wide'),
      category: columnName,
      values: z.array(columnName).min(1),
    })
    .strict(),
  z
    .object({
      shape: z.literal('long'),
      x: columnName,
      series: columnName,
      value: columnName,
    })
    .strict(),
]);
export type ColumnMapping = z.infer<typeof columnMappingSchema>;

/** One widget to produce from an imported file. */
export const importTargetSchema = z
  .object({
    widgetType: z.enum(CHART_WIDGET_TYPES),
    title: widgetTitleSchema,
    /** Worksheet name for spreadsheet formats; must be omitted for single-table formats. */
    sheet: z.string().min(1).optional(),
    mapping: columnMappingSchema,
  })
  .strict();
export type ImportTarget = z.infer<typeof importTargetSchema>;

export const importTargetsSchema = z.array(importTargetSchema).min(1).max(20);

export const importResultSchema = z.object({
  widgets: z.array(z.object({ id: z.uuid(), title: z.string(), status: z.enum(['created', 'replaced', 'skipped']) })),
});
export type ImportResult = z.infer<typeof importResultSchema>;

/**
 * The `Idempotency-Key` header of `POST /api/import`: a client-generated id (a UUID, for example)
 * that makes retrying an import safe. Visible ASCII, at most 255 characters.
 */
export const idempotencyKeySchema = z
  .string()
  .regex(/^[\x21-\x7E]{1,255}$/, 'Idempotency-Key must be 1 to 255 visible ASCII characters');
