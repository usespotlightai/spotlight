import { InvalidSearchIterationError } from '@work/domain/exceptions/invalid-search-iteration.error';
import { SearchIteration } from '@work/domain/value-objects/search-iteration.vo';
import { describe, expect, it } from 'vitest';

describe('SearchIteration', () => {
  it('counts a search’s iterations from one, in whole numbers', () => {
    expect(SearchIteration.of(1).value).toBe(1);
    expect(SearchIteration.of(4).equals(SearchIteration.of(4))).toBe(true);

    for (const wrong of [0, -1, 1.5, Number.NaN]) {
      expect(() => SearchIteration.of(wrong)).toThrow(
        InvalidSearchIterationError,
      );
    }
  });
});
