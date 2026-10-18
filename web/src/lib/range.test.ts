import { describe, expect, it } from 'vitest';
import { DEFAULT_RANGE, rangeOf } from '@/lib/range';

describe('rangeOf', () => {
  it('finds the range requested', () => {
    expect(rangeOf('7d').label).toBe('Past 7 days');
  });

  it('falls back to the default where the range is not one it knows', () => {
    expect(rangeOf('nonsense').id).toBe(DEFAULT_RANGE);
  });
});
