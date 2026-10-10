import { useTheme, type Theme } from '../../theme';

type Scheme = Theme;

/** Categorical slots in fixed order (validated for colour-vision deficiency, adjacent pairs). */
const CATEGORICAL: Record<Scheme, readonly string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

/** Sentiment is polar, not categorical: two poles and a gray midpoint. */
const SENTIMENT: Record<Scheme, Record<string, string>> = {
  light: { positive: '#2a78d6', neutral: '#898781', negative: '#e34948' },
  dark: { positive: '#3987e5', neutral: '#6f6e69', negative: '#e66767' },
};

/** Brands keep their colour in every chart (line, pie, bar), whatever their position. */
const BRAND_SLOTS: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

const OVERFLOW = '#a3a29b';

export const CHART_CHROME: Record<Scheme, { surface: string; grid: string; axis: string; text: string }> = {
  light: { surface: '#fcfcfb', grid: '#e1e0d9', axis: '#898781', text: '#52514e' },
  dark: { surface: '#1a1a19', grid: '#2c2c2a', axis: '#898781', text: '#c3c2b7' },
};

/**
 * Colour follows the entity, not its rank: known brands and sentiments get fixed colours,
 * other series take free slots in order. Series past the palette fold to a neutral gray
 * rather than cycling hues.
 */
export function assignColors(names: readonly string[], scheme: Scheme): string[] {
  const used = new Set(names.map((n) => BRAND_SLOTS[n]).filter((slot) => slot !== undefined));
  const free = CATEGORICAL[scheme].map((_, slot) => slot).filter((slot) => !used.has(slot));

  return names.map((name) => {
    const sentiment = SENTIMENT[scheme][name.toLowerCase()];
    if (sentiment) return sentiment;
    const slot = BRAND_SLOTS[name] ?? free.shift();
    return slot === undefined ? OVERFLOW : CATEGORICAL[scheme][slot]!;
  });
}

export function useChartTheme(names: readonly string[]) {
  const scheme = useTheme();
  return { colors: assignColors(names, scheme), chrome: CHART_CHROME[scheme] };
}
