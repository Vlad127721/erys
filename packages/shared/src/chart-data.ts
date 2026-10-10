import { z } from 'zod';

/** ISO calendar date, e.g. "2024-10-28". Lexicographic order equals chronological order. */
export const isoDateSchema = z.iso.date();

/**
 * Data for charts that plot one or more series over a shared category axis
 * (line, bar, stacked bar). `values[i]` belongs to `categories[i]`; `null` marks a gap.
 */
export const seriesChartDataSchema = z
  .object({
    xAxis: z.enum(['date', 'category']),
    categories: z.array(z.string().min(1)).min(1).max(1000),
    series: z
      .array(
        z.object({
          name: z.string().min(1),
          values: z.array(z.number().finite().nullable()),
        }),
      )
      .min(1)
      .max(50),
  })
  .superRefine((data, ctx) => {
    data.series.forEach((s, i) => {
      if (s.values.length !== data.categories.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['series', i, 'values'],
          message: `Series "${s.name}" has ${s.values.length} values, expected ${data.categories.length}`,
        });
      }
    });
    if (data.xAxis === 'date') {
      data.categories.forEach((c, i) => {
        if (!isoDateSchema.safeParse(c).success) {
          ctx.addIssue({ code: 'custom', path: ['categories', i], message: `"${c}" is not an ISO date` });
        }
      });
    }
    if (new Set(data.categories).size !== data.categories.length) {
      ctx.addIssue({ code: 'custom', path: ['categories'], message: 'Categories must be unique' });
    }
  });

export const pieChartDataSchema = z.object({
  slices: z
    .array(z.object({ name: z.string().min(1), value: z.number().finite().nonnegative() }))
    .min(1)
    .max(100),
});

export const textDataSchema = z.object({
  text: z.string().max(10_000),
});

export type SeriesChartData = z.infer<typeof seriesChartDataSchema>;
export type PieChartData = z.infer<typeof pieChartDataSchema>;
export type TextData = z.infer<typeof textDataSchema>;
