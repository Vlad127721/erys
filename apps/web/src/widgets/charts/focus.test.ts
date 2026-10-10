import type { SeriesChartData } from '@youscan/shared';
import { describe, expect, it } from 'vitest';
import { focusSeriesData } from './focus';

const sentiment: SeriesChartData = {
  xAxis: 'category',
  categories: ['A', 'B', 'C'],
  series: [
    { name: 'Positive', values: [10, 20, 30] },
    { name: 'Negative', values: [1, null, 3] },
  ],
};

const weekly: SeriesChartData = {
  xAxis: 'date',
  categories: ['2025-01-06', '2025-01-13'],
  series: [
    { name: 'A', values: [1, 2] },
    { name: 'B', values: [3, 4] },
  ],
};

describe('focusSeriesData', () => {
  it('returns the data unchanged without a focus', () => {
    expect(focusSeriesData(sentiment, null)).toBe(sentiment);
  });

  it('keeps only the focused series', () => {
    expect(focusSeriesData(sentiment, 'Negative').series).toEqual([{ name: 'Negative', values: [1, null, 3] }]);
    expect(focusSeriesData(weekly, 'B').series.map((s) => s.name)).toEqual(['B']);
  });

  it('keeps only the focused category on a category axis, gaps included', () => {
    expect(focusSeriesData(sentiment, 'B')).toEqual({
      xAxis: 'category',
      categories: ['B'],
      series: [
        { name: 'Positive', values: [20] },
        { name: 'Negative', values: [null] },
      ],
    });
  });

  it('leaves data without the focused value unchanged', () => {
    expect(focusSeriesData(sentiment, 'Neutral')).toBe(sentiment);
    expect(focusSeriesData(weekly, '2025-01-06')).toBe(weekly);
  });
});
