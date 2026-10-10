import { z } from 'zod';
import { pieChartDataSchema, seriesChartDataSchema, textDataSchema } from './chart-data.js';

export const WIDGET_TYPES = ['LINE', 'BAR', 'STACKED_BAR', 'PIE', 'TEXT'] as const;
export const widgetTypeSchema = z.enum(WIDGET_TYPES);
export type WidgetType = z.infer<typeof widgetTypeSchema>;

export const CHART_WIDGET_TYPES = ['LINE', 'BAR', 'STACKED_BAR', 'PIE'] as const satisfies readonly WidgetType[];
export type ChartWidgetType = (typeof CHART_WIDGET_TYPES)[number];

/** Payload of a widget, discriminated by its type. Validated on every write and read. */
export const widgetPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('LINE'), data: seriesChartDataSchema }),
  z.object({ type: z.literal('BAR'), data: seriesChartDataSchema }),
  z.object({ type: z.literal('STACKED_BAR'), data: seriesChartDataSchema }),
  z.object({ type: z.literal('PIE'), data: pieChartDataSchema }),
  z.object({ type: z.literal('TEXT'), data: textDataSchema }),
]);
export type WidgetPayload = z.infer<typeof widgetPayloadSchema>;
export type WidgetData<T extends WidgetType> = Extract<WidgetPayload, { type: T }>['data'];

export const widgetTitleSchema = z.string().trim().min(1).max(120);

/** List item: everything except the (potentially large) data payload. */
export const widgetMetaSchema = z.object({
  id: z.uuid(),
  type: widgetTypeSchema,
  title: z.string(),
  updatedAt: z.iso.datetime(),
});
export type WidgetMeta = z.infer<typeof widgetMetaSchema>;

export const widgetDataResponseSchema = widgetPayloadSchema.and(z.object({ id: z.uuid() }));
export type WidgetDataResponse = z.infer<typeof widgetDataResponseSchema>;

export const createWidgetSchema = z
  .object({
    type: widgetTypeSchema,
    title: widgetTitleSchema.optional(),
  })
  .strict();
export type CreateWidgetRequest = z.infer<typeof createWidgetSchema>;

export const updateTextSchema = textDataSchema.strict();
export type UpdateTextRequest = z.infer<typeof updateTextSchema>;
