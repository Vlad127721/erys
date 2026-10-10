import { assertNever, type SeriesChartData, type WidgetPayload, type WidgetType } from '@youscan/shared';

const BRANDS = ['A', 'B', 'C', 'D', 'E'];
const WEEKS = 12;
const DAY_MS = 86_400_000;

/** Generates plausible demo data for newly created chart widgets. */
export class RandomDataService {
  /** `random` returns numbers in [0, 1); replaceable for deterministic tests. */
  constructor(private readonly random: () => number = Math.random) {}

  generate(type: WidgetType, now = new Date()): WidgetPayload {
    switch (type) {
      case 'LINE':
        return { type, data: this.weeklySeries(now) };
      case 'BAR':
        return { type, data: { xAxis: 'category', categories: BRANDS, series: [this.series('Mentions', BRANDS.length, 100, 2000)] } };
      case 'STACKED_BAR':
        return {
          type,
          data: {
            xAxis: 'category',
            categories: BRANDS,
            series: ['Positive', 'Neutral', 'Negative'].map((name) => this.series(name, BRANDS.length, 50, 1200)),
          },
        };
      case 'PIE':
        return { type, data: { slices: BRANDS.map((name) => ({ name, value: this.int(100, 2000) })) } };
      case 'TEXT':
        // Plain text such as "{A: 40, B: 150, …}"; users edit it as free text.
        return { type, data: { text: `{${BRANDS.map((name) => `${name}: ${this.int(10, 200)}`).join(', ')}}` } };
      default:
        return assertNever(type);
    }
  }

  /** A random walk per brand over the last 12 Mondays. */
  private weeklySeries(now: Date): SeriesChartData {
    const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - ((now.getUTCDay() + 6) % 7) * DAY_MS;
    const categories = Array.from({ length: WEEKS }, (_, i) =>
      new Date(monday - (WEEKS - 1 - i) * 7 * DAY_MS).toISOString().slice(0, 10),
    );
    const series = BRANDS.slice(0, 3).map((name) => {
      let value = this.int(30, 60);
      const values = categories.map(() => (value = Math.max(0, value + this.int(-6, 6))));
      return { name, values };
    });
    return { xAxis: 'date', categories, series };
  }

  private series(name: string, length: number, min: number, max: number) {
    return { name, values: Array.from({ length }, () => this.int(min, max)) };
  }

  private int(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }
}
