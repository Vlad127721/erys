import type { SeriesChartData } from '@youscan/shared';
import { useState } from 'react';

/**
 * Narrows series data to the chart's focus: to one series when the focus names a series,
 * otherwise to one category on a category axis. Data that contains neither is unchanged.
 */
export function focusSeriesData(data: SeriesChartData, focus: string | null): SeriesChartData {
  if (focus === null) return data;

  if (data.series.some((s) => s.name === focus)) {
    return { ...data, series: data.series.filter((s) => s.name === focus) };
  }

  const index = data.xAxis === 'category' ? data.categories.indexOf(focus) : -1;
  if (index === -1) return data;
  return {
    ...data,
    categories: [focus],
    series: data.series.map((s) => ({ ...s, values: [s.values[index] ?? null] })),
  };
}

/**
 * Focus on one value within a single chart. Clicking a value focuses it; clicking the focused
 * value again shows everything. Other charts are unaffected.
 */
export function useChartFocus() {
  const [focus, setFocus] = useState<string | null>(null);
  const toggle = (value: string) => setFocus((current) => (current === value ? null : value));
  return { focus, toggle };
}
