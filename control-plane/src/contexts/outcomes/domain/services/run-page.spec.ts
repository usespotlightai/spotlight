import { InvalidRunPageError } from '@outcomes/domain/exceptions/invalid-run-page.error';
import {
  lastPageOf,
  MOST_RUN_PAGE,
  pageAskedOf,
  pageWithin,
} from '@outcomes/domain/services/run-page';
import { describe, expect, it } from 'vitest';

describe('run pages', () => {
  it('counts one page even when there are no runs', () => {
    expect(lastPageOf(0, 50)).toBe(1);
    expect(lastPageOf(101, 50)).toBe(3);
  });

  it('takes the last page with runs, and refuses one past it', () => {
    expect(() => pageWithin(3, 101, 50)).not.toThrow();
    expect(() => pageWithin(4, 101, 50)).toThrow(InvalidRunPageError);
    expect(() => pageWithin(1, 0, 50)).not.toThrow();
  });

  it('refuses a page past the most it ever pages to before reading any runs', () => {
    expect(pageAskedOf(MOST_RUN_PAGE)).toBe(MOST_RUN_PAGE);
    expect(() => pageAskedOf(MOST_RUN_PAGE + 1)).toThrow(InvalidRunPageError);
  });
});
