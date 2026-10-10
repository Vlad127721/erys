import type { SeriesChartData } from '@youscan/shared';

// --- Y-axis scale -----------------------------------------------------------

/** Steps look "round" when they are one of these times a power of ten: 1, 2, 2.5, 5, 10, 20, 25… */
const ROUND_STEP_MULTIPLIERS = [1, 2, 2.5, 5, 10];
const DEFAULT_TICK_INTERVALS = 4;

/**
 * Round tick values covering [min, max], always including zero.
 * Recharts' defaults produce steps like 550 or 1350 that compact formatting then misreports.
 *
 * @param targetIntervals roughly how many gaps between ticks to aim for
 */
export function niceTicks(min: number, max: number, targetIntervals = DEFAULT_TICK_INTERVALS): number[] {
  const low = Math.min(0, finiteOrZero(min));
  const high = Math.max(0, finiteOrZero(max));
  if (low === high) return [0, 1];

  const intervals = Number.isFinite(targetIntervals) && targetIntervals > 0 ? targetIntervals : DEFAULT_TICK_INTERVALS;
  const step = roundStep((high - low) / intervals);

  // Ticks are computed as index × step rather than by repeated addition, so rounding errors
  // cannot accumulate (which used to produce -5e-20 instead of 0 and an extra tick).
  const firstIndex = Math.floor(stepsIn(low, step));
  const lastIndex = Math.ceil(stepsIn(high, step));
  const ticks: number[] = [];
  for (let index = firstIndex; index <= lastIndex; index++) {
    ticks.push(withoutFloatNoise(index * step));
  }
  return ticks;
}

/** The round step closest to `idealStep`, measured as a ratio: 2× too big is as bad as 2× too small. */
function roundStep(idealStep: number): number {
  const powerOfTen = 10 ** Math.floor(Math.log10(idealStep));
  let best = powerOfTen;
  for (const multiplier of ROUND_STEP_MULTIPLIERS) {
    const candidate = multiplier * powerOfTen;
    if (ratioTo(idealStep, candidate) < ratioTo(idealStep, best)) best = candidate;
  }
  return best;
}

function ratioTo(target: number, candidate: number): number {
  return Math.max(candidate / target, target / candidate);
}

/**
 * How many steps fit in `value`. Snaps only floating-point error (0.3 / 0.1 = 2.9999999999999996
 * counts as 3); a genuine small remainder, like -0.001 against a step of 10 million, still counts
 * so the axis keeps covering it.
 */
function stepsIn(value: number, step: number): number {
  return Math.round((value / step) * 1e12) / 1e12;
}

/** 0.30000000000000004 → 0.3 */
function withoutFloatNoise(value: number): number {
  return Number(value.toPrecision(12));
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * The [min, max] the Y axis must show. Missing values (null) are skipped; in a stacked chart a
 * missing segment adds nothing to its stack. Stacks are measured by their total height:
 * positive segments stack upwards from zero and negative ones downwards, per category.
 */
export function valueExtent(data: SeriesChartData, stacked: boolean): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  const include = (value: number) => {
    min = Math.min(min, value);
    max = Math.max(max, value);
  };

  if (stacked) {
    for (let index = 0; index < data.categories.length; index++) {
      let positiveTotal = 0;
      let negativeTotal = 0;
      for (const series of data.series) {
        const value = series.values[index] ?? 0;
        if (value > 0) positiveTotal += value;
        else negativeTotal += value;
      }
      include(positiveTotal);
      include(negativeTotal);
    }
  } else {
    for (const series of data.series) {
      for (const value of series.values) {
        if (value !== null) include(value);
      }
    }
  }

  return min <= max ? [min, max] : [0, 0];
}

// --- Number and date formatting (axis ticks and tooltips) -------------------

const NO_VALUE = '—';
const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 });
const fullNumber = new Intl.NumberFormat('en');

/** Axis ticks: 1250 → "1.25K". Two fraction digits so a tick never reads as a different value. */
export function formatCompact(value: number): string {
  return Number.isFinite(value) ? compactNumber.format(value) : NO_VALUE;
}

/** Tooltips: 12345 → "12,345"; anything that is not a finite number → "—". */
export function formatNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? fullNumber.format(value) : NO_VALUE;
}

const DAY_MS = 86_400_000;
const SHORT_RANGE_DAYS = 180;
// Categories are ISO dates without a time: format them in UTC so they never shift a day.
const dayMonth = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthOnly = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Tick labels for a date axis: "Oct 28" for ranges up to 180 days, "Oct ’24" for longer ones,
 * so the year is never ambiguous. An empty or unparsable range counts as short.
 */
export function dateTickFormatter(categories: readonly string[]): (isoDate: string) => string {
  return rangeInDays(categories) <= SHORT_RANGE_DAYS ? formatDayMonth : formatMonthYear;
}

/** Tooltip title: "Oct 28, 2024". */
export function formatLongDate(isoDate: string): string {
  return formatIsoDate(isoDate, (date) => fullDate.format(date));
}

function formatDayMonth(isoDate: string): string {
  return formatIsoDate(isoDate, (date) => dayMonth.format(date));
}

function formatMonthYear(isoDate: string): string {
  return formatIsoDate(isoDate, (date) => `${monthOnly.format(date)} ’${String(date.getUTCFullYear()).slice(-2)}`);
}

function rangeInDays(categories: readonly string[]): number {
  const first = parseIsoDate(categories[0]);
  const last = parseIsoDate(categories.at(-1));
  if (!first || !last) return 0;
  return (last.getTime() - first.getTime()) / DAY_MS;
}

/** Shows an unparsable value as is instead of throwing ("Invalid time value") mid-render. */
function formatIsoDate(isoDate: string, format: (date: Date) => string): string {
  const date = parseIsoDate(isoDate);
  return date ? format(date) : isoDate;
}

function parseIsoDate(isoDate: string | undefined): Date | null {
  if (isoDate === undefined) return null;
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
