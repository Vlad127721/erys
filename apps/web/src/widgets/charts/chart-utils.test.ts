import type { SeriesChartData } from '@youscan/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { dateTickFormatter, formatCompact, formatLongDate, formatNumber, niceTicks, valueExtent } from './chart-utils';

describe('niceTicks', () => {
  it.each([
    [0, 2105, [0, 500, 1000, 1500, 2000, 2500]],
    [0, 1700, [0, 500, 1000, 1500, 2000]],
    [24, 55, [0, 10, 20, 30, 40, 50, 60]],
    [-30, 40, [-40, -20, 0, 20, 40]],
    [-30, -5, [-30, -20, -10, 0]],
    [0, 0.7, [0, 0.2, 0.4, 0.6, 0.8]],
    [5, 5, [0, 1, 2, 3, 4, 5]],
    [0, 0, [0, 1]],
  ])('covers [%d, %d] with round steps', (min, max, expected) => {
    expect(niceTicks(min, max)).toEqual(expected);
  });

  it.each([
    [0, 2105],
    [-0.07, 0.31],
    [-1234, -56],
    [0.001, 0.0042],
    [-98765, 12345],
    [3, 2.5e7],
  ])('ticks for [%d, %d] cover the range with one round step, through zero', (min, max) => {
    const ticks = niceTicks(min, max);
    const step = ticks[1]! - ticks[0]!;
    const magnitude = 10 ** Math.floor(Math.log10(step));

    expect(ticks[0]).toBeLessThanOrEqual(Math.min(0, min));
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(Math.max(0, max));
    expect(ticks.at(-2)!).toBeLessThan(Math.max(0, max));
    expect(ticks).toContain(0);
    expect([1, 2, 2.5, 5].map((m) => m * magnitude)).toContainEqual(expect.closeTo(step, 12));
    ticks.slice(1).forEach((tick, i) => expect(tick - ticks[i]!).toBeCloseTo(step, 9));
  });

  it('builds ticks without floating-point drift (regression: -5e-20 instead of 0, extra tick)', () => {
    expect(niceTicks(-0.001, 0, 5)).toEqual([-0.001, -0.0008, -0.0006, -0.0004, -0.0002, 0]);
    expect(niceTicks(-0.07, 0, 2)).toEqual([-0.075, -0.05, -0.025, 0]);
    expect(niceTicks(0, 0.3, 3)).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it('still covers a tiny remainder far below the step', () => {
    expect(niceTicks(-0.001, 25_000_000)[0]).toBe(-5_000_000);
  });

  it('treats non-finite bounds as zero', () => {
    expect(niceTicks(Number.NaN, 10)).toEqual(niceTicks(0, 10));
    expect(niceTicks(0, Number.POSITIVE_INFINITY)).toEqual([0, 1]);
    expect(niceTicks(Number.NEGATIVE_INFINITY, Number.NaN)).toEqual([0, 1]);
  });

  it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY])('falls back to the default target for %d', (target) => {
    expect(niceTicks(0, 100, target)).toEqual(niceTicks(0, 100));
  });
});

describe('valueExtent', () => {
  const chart = (rows: (number | null)[][]): SeriesChartData => ({
    xAxis: 'category',
    categories: rows[0]?.map((_, i) => `C${i}`) ?? [],
    series: rows.map((values, i) => ({ name: `S${i}`, values })),
  });

  it('uses non-null values for plain series', () => {
    expect(
      valueExtent(
        chart([
          [1, null],
          [5, 2],
        ]),
        false,
      ),
    ).toEqual([1, 5]);
    expect(
      valueExtent(
        chart([
          [-3, 4],
          [2, -6],
        ]),
        false,
      ),
    ).toEqual([-6, 4]);
  });

  it('measures stacks by their total height, not the largest segment', () => {
    expect(
      valueExtent(
        chart([
          [1, null],
          [5, 2],
        ]),
        true,
      ),
    ).toEqual([0, 6]);
    expect(valueExtent(chart([[3], [4]]), true)).toEqual([0, 7]);
  });

  it('stacks positive and negative segments separately per category', () => {
    // Per category: C0 +6/-2, C1 +3/-1, C2 +4/-8.
    expect(
      valueExtent(
        chart([
          [5, -1, null],
          [-2, 3, 4],
          [1, null, -8],
        ]),
        true,
      ),
    ).toEqual([-8, 6]);
  });

  it('is [0, 0] when there is nothing to show', () => {
    expect(valueExtent(chart([[null, null]]), false)).toEqual([0, 0]);
    expect(valueExtent(chart([[null, null]]), true)).toEqual([0, 0]);
    expect(valueExtent(chart([]), false)).toEqual([0, 0]);
    expect(valueExtent(chart([]), true)).toEqual([0, 0]);
  });
});

describe('number formatting', () => {
  it('formats axis ticks compactly without rounding them into a different value', () => {
    expect([0, 750, 1250, 2500, 123456, -1500].map(formatCompact)).toEqual([
      '0',
      '750',
      '1.25K',
      '2.5K',
      '123.46K',
      '-1.5K',
    ]);
  });

  it('formats tooltip values in full', () => {
    expect(formatNumber(12345)).toBe('12,345');
    expect(formatNumber(1234.5678)).toBe('1,234.568');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, '5', null, undefined])('shows a dash for %s', (value) => {
    expect(formatNumber(value)).toBe('—');
  });

  it('shows a dash for a non-finite tick', () => {
    expect(formatCompact(Number.NaN)).toBe('—');
  });
});

describe('date formatting', () => {
  // Dates are midnight UTC; a local timezone west of UTC must not turn Jan 1 into Dec 31.
  beforeAll(() => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('runs these checks in a timezone west of UTC', () => {
    expect(new Date('2025-01-01T00:00:00Z').getDate()).toBe(31);
  });

  it('shows month and day for ranges up to 180 days', () => {
    expect(dateTickFormatter(['2025-01-06', '2025-03-31'])('2025-01-06')).toBe('Jan 6');
    expect(dateTickFormatter(['2025-01-01', '2025-06-30'])('2025-01-01')).toBe('Jan 1');
  });

  it('shows month and year once the range is longer', () => {
    expect(dateTickFormatter(['2025-01-01', '2025-07-01'])('2025-01-01')).toBe('Jan ’25');
    expect(dateTickFormatter(['2024-10-28', '2025-11-03'])('2024-12-16')).toBe('Dec ’24');
  });

  it('treats an empty or unparsable range as short', () => {
    expect(dateTickFormatter([])('2025-03-01')).toBe('Mar 1');
    expect(dateTickFormatter(['not-a-date', '2030-01-01'])('2025-03-01')).toBe('Mar 1');
  });

  it('formats tooltip dates in full, in UTC', () => {
    expect(formatLongDate('2025-01-01')).toBe('Jan 1, 2025');
    expect(formatLongDate('2024-02-29')).toBe('Feb 29, 2024');
  });

  it('shows an unparsable date as is instead of throwing', () => {
    expect(formatLongDate('2025-13-40')).toBe('2025-13-40');
    expect(dateTickFormatter(['2025-01-01', '2025-02-01'])('oops')).toBe('oops');
  });
});
