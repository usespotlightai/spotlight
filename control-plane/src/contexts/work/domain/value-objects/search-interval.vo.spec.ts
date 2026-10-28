import { InvalidSearchIntervalError } from '@work/domain/exceptions/invalid-search-interval.error';
import { SearchInterval } from '@work/domain/value-objects/search-interval.vo';
import { describe, expect, it } from 'vitest';

const HOUR = 60 * 60 * 1_000;

describe('SearchInterval', () => {
  it('reads minutes, hours and days, and keeps the text as written', () => {
    expect(SearchInterval.of('90m')).toMatchObject({
      text: '90m',
      milliseconds: 1.5 * HOUR,
    });
    expect(SearchInterval.of(' 12h ').milliseconds).toBe(12 * HOUR);
    expect(SearchInterval.of('7d').milliseconds).toBe(7 * 24 * HOUR);
  });

  it('refuses anything shorter than an hour or longer than a year', () => {
    expect(() => SearchInterval.of('30m')).toThrow(InvalidSearchIntervalError);
    expect(() => SearchInterval.of('366d')).toThrow(InvalidSearchIntervalError);
  });

  it('refuses text that is not a whole number and a unit', () => {
    for (const written of ['', '7', '1.5d', '7 d', '2w', '-1d', 'P7D']) {
      expect(() => SearchInterval.of(written)).toThrow(
        InvalidSearchIntervalError,
      );
    }
  });

  it('is equal to an interval of the same length, however it is written', () => {
    expect(SearchInterval.of('24h').equals(SearchInterval.of('1d'))).toBe(true);
    expect(SearchInterval.of('24h').equals(SearchInterval.of('2d'))).toBe(
      false,
    );
  });

  it('compares lengths', () => {
    expect(SearchInterval.of('3d').isLongerThan(SearchInterval.of('2d'))).toBe(
      true,
    );
    expect(SearchInterval.of('2d').isLongerThan(SearchInterval.of('48h'))).toBe(
      false,
    );
  });
});
