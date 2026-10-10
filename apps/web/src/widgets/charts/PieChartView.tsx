import type { PieChartData } from '@youscan/shared';
import { Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';
import { ChartLegend } from './ChartLegend';
import { ChartFrame, chartAnimation, tooltipProps } from './chart-parts';
import { formatNumber } from './chart-utils';
import { useChartFocus } from './focus';
import { useChartTheme } from './palette';

/** Slices other than the focused one are muted, not removed: a one-slice pie says nothing. */
const MUTED_OPACITY = 0.25;

export function PieChartView({ data }: { data: PieChartData }) {
  const { focus, toggle } = useChartFocus();
  const names = data.slices.map((s) => s.name);
  const { colors, chrome } = useChartTheme(names);
  const total = data.slices.reduce((sum, s) => sum + s.value, 0);
  const percent = (value: number) => (total === 0 ? '0%' : `${Math.round((value / total) * 100)}%`);
  const filtering = focus !== null && names.includes(focus);

  return (
    <ChartFrame
      label={`Pie chart: ${data.slices.map((s) => `${s.name} ${percent(s.value)}`).join(', ')}`}
      legend={
        <ChartLegend
          items={names.map((name, i) => ({ name, color: colors[i]! }))}
          focus={focus}
          onToggle={toggle}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart accessibilityLayer={false}>
          <Pie
            data={data.slices}
            dataKey="value"
            nameKey="name"
            outerRadius="80%"
            stroke={chrome.surface}
            strokeWidth={2}
            {...chartAnimation()}
            className="cursor-pointer"
            onClick={(_, index) => {
              const slice = data.slices[index];
              if (slice) toggle(slice.name);
            }}
            shape={(props) => (
              <Sector
                {...props}
                fill={colors[props.index]}
                fillOpacity={filtering && data.slices[props.index]?.name !== focus ? MUTED_OPACITY : 1}
              />
            )}
          />
          <Tooltip
            {...tooltipProps(chrome)}
            formatter={(value) => `${formatNumber(value)} (${percent(Number(value))})`}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
