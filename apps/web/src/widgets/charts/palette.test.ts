import { describe, expect, it } from 'vitest';
import { assignColors } from './palette';

describe('assignColors', () => {
  it('gives a brand the same colour regardless of its position', () => {
    const [a] = assignColors(['A', 'B'], 'light');
    const [, aLater] = assignColors(['C', 'A'], 'light');
    expect(aLater).toBe(a);
  });

  it('maps sentiment to its polar colours', () => {
    expect(assignColors(['Positive', 'Neutral', 'Negative'], 'light')).toEqual(['#2a78d6', '#898781', '#e34948']);
  });

  it('folds series beyond the palette into gray instead of cycling hues', () => {
    const colors = assignColors(
      Array.from({ length: 10 }, (_, i) => `S${i}`),
      'light',
    );
    expect(new Set(colors.slice(0, 8)).size).toBe(8);
    expect(colors.slice(8)).toEqual(['#a3a29b', '#a3a29b']);
  });
});
