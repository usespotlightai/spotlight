import { sameField } from '@replays/domain/services/field-comparison';
import { describe, expect, it } from 'vitest';

describe('sameField', () => {
  it('compares values whatever order their keys were written in', () => {
    expect(
      sameField({ a: 1, b: [{ c: 2, d: 3 }] }, { b: [{ d: 3, c: 2 }], a: 1 }),
    ).toBe(true);
    expect(sameField(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameField(undefined, null)).toBe(true);
  });

  it('treats an empty list as unset only when asked', () => {
    expect(sameField([], undefined)).toBe(false);
    expect(sameField([], undefined, { emptyIsUnset: true })).toBe(true);
    expect(sameField(['gpu'], undefined, { emptyIsUnset: true })).toBe(false);
  });
});
