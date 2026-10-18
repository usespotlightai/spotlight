import {
  type ChartPoint,
  chartCurrencyOf,
  chartStatusOf,
} from '@replays/domain/services/replayed-chart';
import { describe, expect, it } from 'vitest';

const point = (part: Partial<ChartPoint> = {}): ChartPoint => ({
  finished: true,
  success: 0.7,
  cost: 0.4,
  currency: 'USD',
  ...part,
});

describe('chartCurrencyOf', () => {
  it('draws the chart in the baseline’s currency, else the newest candidate’s', () => {
    expect(chartCurrencyOf('EUR', 'USD')).toBe('EUR');
    expect(chartCurrencyOf(null, 'USD')).toBe('USD');
    expect(chartCurrencyOf(null, null)).toBeNull();
  });
});

describe('chartStatusOf', () => {
  it('prices a finished, scored and costed point in the chart currency', () => {
    expect(chartStatusOf(point(), 'USD')).toBe('priced');
  });

  it('keeps a point costed in another currency off the chart', () => {
    expect(chartStatusOf(point(), 'EUR')).toBe('other-currency');
    expect(chartStatusOf(point(), null)).toBe('other-currency');
  });

  it('keeps an unpriced point off the chart', () => {
    expect(chartStatusOf(point({ cost: null }), 'USD')).toBe('unpriced');
  });

  it('keeps an unscored point off the chart before it requests its cost', () => {
    expect(chartStatusOf(point({ success: null, cost: null }), 'USD')).toBe(
      'unscored',
    );
  });

  it('keeps an unfinished replay off the chart whatever it scored', () => {
    expect(chartStatusOf(point({ finished: false }), 'USD')).toBe('unfinished');
  });
});
