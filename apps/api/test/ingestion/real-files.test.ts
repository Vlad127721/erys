import { readFile } from 'node:fs/promises';
import type { ImportTarget, SeriesChartData } from '@youscan/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { extractWidgets, type SourceFile } from '../../src/ingestion/extract-widgets.js';
import { ParserRegistry } from '../../src/ingestion/parsers/parser-registry.js';
import { dataFile } from '../helpers.js';

/**
 * Runs the full parse → normalize → map pipeline on the files supplied with the task.
 * Expected numbers were read from the raw files independently of this code.
 */
const parsers = new ParserRegistry();

const lineTarget: ImportTarget = {
  widgetType: 'LINE',
  title: 'Results by campaign',
  sheet: 'line chart data',
  mapping: { shape: 'long', x: 'Date', series: 'Campaign', value: 'Result' },
};
const pieTarget: ImportTarget = {
  widgetType: 'PIE',
  title: 'Share by campaign',
  sheet: 'pie chart data',
  mapping: { shape: 'wide', category: 'Campaign', values: ['Result'] },
};
const stackedTarget: ImportTarget = {
  widgetType: 'STACKED_BAR',
  title: 'Sentiment by brand',
  mapping: { shape: 'wide', category: 'Brand', values: ['Positive', 'Neutral', 'Negative'] },
};

async function load(name: string): Promise<SourceFile> {
  return { name, content: await readFile(dataFile(name)) };
}

describe('line-and-pie.xlsx', () => {
  let line: SeriesChartData;

  beforeAll(async () => {
    const [widget] = await extractWidgets(parsers, await load('line-and-pie.xlsx'), [lineTarget]);
    expect(widget!.payload.type).toBe('LINE');
    line = widget!.payload.data as SeriesChartData;
  });

  it('pivots the long table into one series per campaign', () => {
    expect(line.series.map((s) => s.name).sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
    for (const s of line.series) expect(s.values).toHaveLength(line.categories.length);
  });

  it('reads Excel date cells as ISO dates and sorts them chronologically', () => {
    expect(line.xAxis).toBe('date');
    expect(line.categories).toHaveLength(54);
    expect(line.categories[0]).toBe('2024-10-28');
    expect(line.categories.at(-1)).toBe('2025-11-03');
    expect([...line.categories].sort()).toEqual(line.categories);
  });

  it('keeps the exact values from the sheet', () => {
    const at = (series: string, date: string) =>
      line.series.find((s) => s.name === series)!.values[line.categories.indexOf(date)];
    expect(at('A', '2024-10-28')).toBe(48);
    expect(at('A', '2025-02-10')).toBe(37);
    expect(at('B', '2024-10-28')).toBe(46);
    expect(at('C', '2024-10-28')).toBe(33);
  });

  it('keeps missing weeks as null gaps, not zeros', () => {
    const count = (name: string) => line.series.find((s) => s.name === name)!.values.filter((v) => v !== null).length;
    // 212 data rows in the sheet = 48 + 40 + 44 + 54 + 26 points.
    expect([count('A'), count('B'), count('C'), count('D'), count('E')]).toEqual([48, 40, 44, 54, 26]);

    const e = line.series.find((s) => s.name === 'E')!;
    const lastE = line.categories.indexOf('2025-04-21');
    expect(e.values[lastE]).not.toBeNull();
    expect(e.values.slice(lastE + 1).every((v) => v === null)).toBe(true);
    expect(line.series.flatMap((s) => s.values)).not.toContain(0);
  });

  it('builds pie slices from the second sheet, ignoring empty styled header cells', async () => {
    const [pie] = await extractWidgets(parsers, await load('line-and-pie.xlsx'), [pieTarget]);
    expect(pie!.payload).toEqual({
      type: 'PIE',
      data: {
        slices: [
          { name: 'A', value: 1895 },
          { name: 'B', value: 1699 },
          { name: 'C', value: 1782 },
          { name: 'D', value: 2105 },
          { name: 'E', value: 988 },
        ],
      },
    });
  });

  it('extracts several widgets from one workbook in a single pass', async () => {
    const widgets = await extractWidgets(parsers, await load('line-and-pie.xlsx'), [lineTarget, pieTarget]);
    expect(widgets.map((w) => w.payload.type)).toEqual(['LINE', 'PIE']);
  });
});

describe('stacked-bar.csv', () => {
  it('maps the wide table to one stacked series per sentiment column', async () => {
    const [widget] = await extractWidgets(parsers, await load('stacked-bar.csv'), [stackedTarget]);
    expect(widget!.payload).toEqual({
      type: 'STACKED_BAR',
      data: {
        xAxis: 'category',
        categories: ['A', 'B', 'C', 'D', 'E'],
        series: [
          { name: 'Positive', values: [1137, 764, 927, 800, 672] },
          { name: 'Neutral', values: [531, 595, 534, 884, 217] },
          { name: 'Negative', values: [227, 340, 321, 421, 99] },
        ],
      },
    });
  });
});

describe('mapping errors on the real files', () => {
  it('names the missing column and lists the available ones', async () => {
    const target = { ...lineTarget, mapping: { ...lineTarget.mapping, value: 'Score' } } as ImportTarget;
    await expect(extractWidgets(parsers, await load('line-and-pie.xlsx'), [target])).rejects.toThrow(
      /Column\(s\) "Score" not found in sheet "line chart data"\. Available: id, Campaign, Date, Result/,
    );
  });

  it('rejects an unknown sheet', async () => {
    await expect(
      extractWidgets(parsers, await load('line-and-pie.xlsx'), [{ ...lineTarget, sheet: 'nope' }]),
    ).rejects.toThrow(/Sheet "nope" not found\. Available: line chart data, pie chart data/);
  });

  it('requires a sheet for multi-sheet workbooks instead of guessing', async () => {
    const { sheet: _sheet, ...withoutSheet } = lineTarget;
    await expect(extractWidgets(parsers, await load('line-and-pie.xlsx'), [withoutSheet])).rejects.toThrow(
      /several sheets/,
    );
  });

  it('rejects a sheet name for CSV', async () => {
    await expect(
      extractWidgets(parsers, await load('stacked-bar.csv'), [{ ...stackedTarget, sheet: 'x' }]),
    ).rejects.toThrow(/no sheets/);
  });

  it('rejects a long mapping for a pie chart', async () => {
    const target: ImportTarget = { ...pieTarget, mapping: lineTarget.mapping, sheet: 'line chart data' };
    await expect(extractWidgets(parsers, await load('line-and-pie.xlsx'), [target])).rejects.toThrow(/exactly one value column/);
  });
});
