import type { CSSProperties, ReactNode } from 'react';
import type { CHART_CHROME } from './palette';

type Chrome = (typeof CHART_CHROME)['light'];

/** Shared Recharts props so every chart has the same quiet chrome. */
export const axisProps = (chrome: Chrome) => ({
  stroke: chrome.grid,
  tick: { fill: chrome.axis, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: chrome.grid },
});

export const tooltipProps = (chrome: Chrome) => ({
  contentStyle: {
    background: chrome.surface,
    border: `1px solid ${chrome.grid}`,
    borderRadius: 8,
    fontSize: 12,
    color: chrome.text,
  } satisfies CSSProperties,
  labelStyle: { color: chrome.text, fontWeight: 600 } satisfies CSSProperties,
  itemStyle: { color: chrome.text } satisfies CSSProperties,
});

/**
 * Recharts entrance animation: lines draw in, bars grow from the baseline, the pie sweeps open.
 * It replays when a filter changes the data. "auto" turns it off for prefers-reduced-motion.
 */
export const chartAnimation = (delayMs = 0) =>
  ({
    isAnimationActive: 'auto',
    animationBegin: delayMs,
    animationDuration: 700,
    animationEasing: 'ease-out',
  }) as const;

/** The plot is one image for assistive tech; the legend below it stays interactive. */
export function ChartFrame({ label, legend, children }: { label: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <figure className="m-0 flex h-[280px] flex-1 flex-col gap-2">
      {/* Recharts 3 gives its internal layers tabindex="-1": a click focuses them and draws an outline. */}
      <div className="min-h-0 flex-1 [&_:focus]:outline-none" role="img" aria-label={label}>
        {children}
      </div>
      {legend}
    </figure>
  );
}

interface CategoryTickProps {
  x?: number | string;
  y?: number | string;
  payload?: { value?: unknown };
  chrome: Chrome;
  focus: string | null;
  onToggle: (value: string) => void;
}

/** X-axis category label that toggles the chart's filter, like a legend entry. */
export function CategoryTick({ x, y, payload, chrome, focus, onToggle }: CategoryTickProps) {
  const value = String(payload?.value ?? '');
  const active = focus === value;
  return (
    <g className="cursor-pointer" onClick={() => onToggle(value)}>
      <title>{active ? `Show all (clear filter ${value})` : `Show only ${value}`}</title>
      <text
        x={x}
        y={y}
        dy={14}
        textAnchor="middle"
        fontSize={12}
        fontWeight={active ? 600 : 400}
        fill={active ? chrome.text : chrome.axis}
      >
        {value}
      </text>
    </g>
  );
}
