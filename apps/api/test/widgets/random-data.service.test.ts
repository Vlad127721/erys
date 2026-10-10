import { WIDGET_TYPES, widgetPayloadSchema } from '@youscan/shared';
import { describe, expect, it } from 'vitest';
import { RandomDataService } from '../../src/widgets/random-data.service.js';

describe('RandomDataService', () => {
  it.each(WIDGET_TYPES)('generates valid %s data', (type) => {
    const payload = new RandomDataService().generate(type);
    expect(widgetPayloadSchema.parse(payload).type).toBe(type);
  });

  it('generates text as "{brand: value, …}" for every brand', () => {
    const lowest = new RandomDataService(() => 0).generate('TEXT');
    expect(lowest).toEqual({ type: 'TEXT', data: { text: '{A: 10, B: 10, C: 10, D: 10, E: 10}' } });
  });
});
