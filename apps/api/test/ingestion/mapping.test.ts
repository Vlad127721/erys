import type { ImportTarget } from '@youscan/shared';
import { describe, expect, it } from 'vitest';
import { extractWidgets } from '../../src/ingestion/extract-widgets.js';
import { IngestionError } from '../../src/ingestion/ingestion.errors.js';
import { ParserRegistry } from '../../src/ingestion/parsers/parser-registry.js';

const parsers = new ParserRegistry();
const csv = (text: string) => ({ name: 'test.csv', content: new TextEncoder().encode(text) });
const extract = async (text: string, target: ImportTarget) => (await extractWidgets(parsers, csv(text), [target]))[0]!.payload;

const longLine: ImportTarget = {
  widgetType: 'LINE',
  title: 'Line',
  mapping: { shape: 'long', x: 'Date', series: 'Brand', value: 'Value' },
};
const wideBar: ImportTarget = {
  widgetType: 'BAR',
  title: 'Bar',
  mapping: { shape: 'wide', category: 'Brand', values: ['Value'] },
};

describe('widget types', () => {
  const table = 'Brand,Value\nA,1\nB,2\n';
  const series = { xAxis: 'category', categories: ['A', 'B'], series: [{ name: 'Value', values: [1, 2] }] };

  it.each(['LINE', 'BAR', 'STACKED_BAR'] as const)('builds %s from series data', async (widgetType) => {
    expect(await extract(table, { ...wideBar, widgetType })).toEqual({ type: widgetType, data: series });
  });

  it('builds PIE from slices', async () => {
    expect(await extract(table, { ...wideBar, widgetType: 'PIE' })).toEqual({
      type: 'PIE',
      data: { slices: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] },
    });
  });

  it('reports schema issues when mapped data is invalid', async () => {
    const error = await extract('Brand,Value\nA,-1\n', { ...wideBar, widgetType: 'PIE' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(IngestionError);
    expect((error as IngestionError).message).toMatch(/Imported data is not a valid PIE widget/);
    expect((error as IngestionError).details).toEqual([
      expect.objectContaining({ path: ['data', 'slices', 0, 'value'], code: 'too_small' }),
    ]);
  });
});

describe('mapping edge cases', () => {
  it('sorts ISO date strings chronologically and fills missing pairs with null', async () => {
    const payload = await extract(
      'Date,Brand,Value\n2025-01-13,A,3\n2025-01-06,A,1\n2025-01-06,B,2\n',
      longLine,
    );
    expect(payload).toEqual({
      type: 'LINE',
      data: {
        xAxis: 'date',
        categories: ['2025-01-06', '2025-01-13'],
        series: [
          { name: 'A', values: [1, 3] },
          { name: 'B', values: [2, null] },
        ],
      },
    });
  });

  it('keeps file order for non-date categories', async () => {
    const payload = await extract('Brand,Value\nZ,1\nA,2\n', wideBar);
    expect(payload.data).toMatchObject({ xAxis: 'category', categories: ['Z', 'A'] });
  });

  it('treats empty cells as gaps, never as zero', async () => {
    const payload = await extract('Brand,Value\nA,\nB,5\n', wideBar);
    expect(payload.data).toMatchObject({ series: [{ name: 'Value', values: [null, 5] }] });
  });

  it('skips blank lines and a UTF-8 BOM', async () => {
    const payload = await extract('﻿Brand,Value\n\nA,1\n,\n', wideBar);
    expect(payload.data).toMatchObject({ categories: ['A'] });
  });

  it.each([
    ['a non-numeric value', 'Brand,Value\nA,ten\n', wideBar, /"Value" at row 2 is not a number: "ten"/],
    ['a duplicate category', 'Brand,Value\nA,1\nA,2\n', wideBar, /Duplicate category "A"/],
    ['a duplicate (series, x) pair', 'Date,Brand,Value\n2025-01-06,A,1\n2025-01-06,A,2\n', longLine, /Duplicate value for "A" at "2025-01-06" \(row 3\)/],
    ['an empty category', 'Brand,Value\n,1\n', wideBar, /Empty "Brand" at row 2/],
    ['values in a column without header', 'Brand,Value,\nA,1,7\n', wideBar, /Column 3 has values \(row 2\) but no header/],
    ['duplicate header names', 'Brand,Value,Value\nA,1,2\n', wideBar, /Duplicate column "Value"/],
    ['a header-only file', 'Brand,Value\n', wideBar, /Imported data is not a valid BAR widget/],
    ['an empty file', '', wideBar, /No data found/],
    ['ragged rows', 'Brand,Value\nA,1,2\n', wideBar, /Malformed CSV/],
    ['a negative pie slice', 'Brand,Value\nA,-1\n', { ...wideBar, widgetType: 'PIE' }, /not a valid PIE widget/],
  ] as const)('rejects %s', async (_case, text, target, message) => {
    await expect(extract(text, target as ImportTarget)).rejects.toThrow(message);
  });

describe('CSV row numbers in errors', () => {
  // Regression: blank lines were dropped before normalization, so "row N" counted only
  // non-blank lines and pointed at the wrong line of the file.
  it.each([
    ['after blank lines', 'Brand,Value\n\n\nA,1\nB,oops\n', 5],
    ['with CRLF line endings', 'Brand,Value\r\n\r\nA,1\r\nB,oops\r\n', 4],
    ['after a quoted value spanning two lines', 'Brand,Value\n"A\nmulti",1\nB,oops\n', 4],
    ['with blank lines before the header', '\n\nBrand,Value\nA,oops\n', 4],
    // csv-parse's own line counter treats a CRLF inside quotes as two lines.
    ['after a quoted value with a CRLF inside', 'Brand,Value\r\n"A\r\nmulti",1\r\nB,oops\r\n', 4],
  ])('match the file line %s', async (_case, text, line) => {
    await expect(extract(text, wideBar)).rejects.toThrow(`"Value" at row ${line} is not a number: "oops"`);
  });

  it('keeps a multi-line quoted value intact', async () => {
    const payload = await extract('Brand,Value\n"A\nmulti",1\n', wideBar);
    expect(payload.data).toMatchObject({ categories: ['A\nmulti'] });
  });
});
});
