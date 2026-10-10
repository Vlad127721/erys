import { assertNever, type SeriesChartData } from '@youscan/shared';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartLegend } from './ChartLegend';
import { CategoryTick, ChartFrame, axisProps, chartAnimation, tooltipProps } from './chart-parts';
import { focusSeriesData, useChartFocus } from './focus';
import { dateTickFormatter, formatCompact, formatLongDate, formatNumber, niceTicks, valueExtent } from './chart-utils';
import { useChartTheme, type CHART_CHROME } from './palette';

export type SeriesVariant = 'line' | 'bar' | 'stacked';
type Mark = 'line' | 'bar';
type XAxisKind = SeriesChartData['xAxis'];

// Records keyed by a union fail to compile when a member is added without an entry.
const VARIANTS: Record<SeriesVariant, { label: string; mark: Mark; stacked: boolean }> = {
  line: { label: 'Line', mark: 'line', stacked: false },
  bar: { label: 'Bar', mark: 'bar', stacked: false },
  stacked: { label: 'Stacked bar', mark: 'bar', stacked: true },
};

const X_AXES: Record<
  XAxisKind,
  {
    noun: string;
    tickFormatter: (categories: readonly string[]) => ((value: string) => string) | undefined;
    labelFormatter: (value: string) => string;
  }
> = {
  date: { noun: 'dates', tickFormatter: dateTickFormatter, labelFormatter: formatLongDate },
  category: { noun: 'categories', tickFormatter: () => undefined, labelFormatter: (value) => value },
};

function tooltipCursor(mark: Mark, chrome: (typeof CHART_CHROME)['light']) {
  switch (mark) {
    case 'line':
      return { stroke: chrome.axis, strokeWidth: 1 };
    case 'bar':
      return { fill: chrome.grid, opacity: 0.5 };
    default:
      return assertNever(mark);
  }
}

interface Props {
  data: SeriesChartData;
  variant: SeriesVariant;
}

/** Line, bar and stacked bar share one data shape: categories on X, one value per series. */
export function SeriesChart({ data, variant }: Props) {
  const { focus, toggle } = useChartFocus();
  const names = data.series.map((s) => s.name);
  // Colours are assigned on the full series list so a filter never repaints a series.
  const { colors, chrome } = useChartTheme(names);
  const colorOf = new Map(names.map((name, k) => [name, colors[k]]));
  const shown = focusSeriesData(data, focus);

  // Series are keyed by index so that names like "category" cannot clash with the X key.
  const rows = shown.categories.map((category, i) => ({
    category,
    ...Object.fromEntries(shown.series.map((s, k) => [`s${k}`, s.values[i]])),
  }));
  const { label: variantLabel, mark, stacked } = VARIANTS[variant];
  const axis = X_AXES[data.xAxis];
  const ticks = niceTicks(...valueExtent(shown, stacked));
  const label = `${variantLabel} chart of ${shown.series.map((s) => s.name).join(', ')} across ${shown.categories.length} ${axis.noun}`;

  const xAxis = (
    <XAxis
      dataKey="category"
      {...axisProps(chrome)}
      tickFormatter={axis.tickFormatter(shown.categories)}
      // Category labels are filters too; dates are not.
      tick={
        data.xAxis === 'category'
          ? (props: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) => (
              <CategoryTick {...props} chrome={chrome} focus={focus} onToggle={toggle} />
            )
          : axisProps(chrome).tick
      }
      minTickGap={16}
    />
  );
  const yAxis = (
    <YAxis
      {...axisProps(chrome)}
      axisLine={false}
      ticks={ticks}
      domain={[ticks[0]!, ticks.at(-1)!]}
      tickFormatter={formatCompact}
      width={40}
    />
  );
  const grid = <CartesianGrid vertical={false} stroke={chrome.grid} />;
  const tooltip = (
    <Tooltip
      {...tooltipProps(chrome)}
      labelFormatter={(value) => axis.labelFormatter(String(value))}
      formatter={formatNumber}
      // Series order, as in the legend (Recharts sorts by name by default).
      itemSorter={(item) => Number(String(item.dataKey).slice(1))}
      cursor={tooltipCursor(mark, chrome)}
    />
  );
  const legend = names.length > 1 && (
    <ChartLegend items={names.map((name) => ({ name, color: colorOf.get(name)! }))} focus={focus} onToggle={toggle} />
  );

  const renderChart = () => {
    switch (mark) {
      case 'line':
        return (
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer={false}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            {shown.series.map((s, k) => (
              <Line
                key={s.name}
                dataKey={`s${k}`}
                name={s.name}
                stroke={colorOf.get(s.name)}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, stroke: chrome.surface, strokeWidth: 2 }}
                // Missing values are real gaps, not interpolated.
                connectNulls={false}
                {...chartAnimation()}
              />
            ))}
          </LineChart>
        );
      case 'bar':
        return (
          <BarChart
            data={rows}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            barGap={2}
            accessibilityLayer={false}
          >
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            {shown.series.map((s, k) => {
              const isTop = !stacked || k === shown.series.length - 1;
              return (
                <Bar
                  key={s.name}
                  dataKey={`s${k}`}
                  name={s.name}
                  fill={colorOf.get(s.name)}
                  stackId={stacked ? 'stack' : undefined}
                  maxBarSize={24}
                  radius={isTop ? [4, 4, 0, 0] : 0}
                  // A surface-coloured stroke leaves a 2px gap between stacked segments.
                  stroke={chrome.surface}
                  strokeWidth={stacked ? 2 : 0}
                  // Stacked segments grow one after another, bottom first.
                  {...chartAnimation(stacked ? k * 150 : 0)}
                />
              );
            })}
          </BarChart>
        );
      default:
        return assertNever(mark);
    }
  };

  return (
    <ChartFrame label={label} legend={legend}>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </ChartFrame>
  );
}
