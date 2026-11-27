import { describe, expect, it } from 'vitest';

import { nonEmpty } from './non-empty';

describe('nonEmpty', () => {
  it('holds for a string with text', () => {
    expect(nonEmpty('main')).toBe(true);
  });

  it('fails for an empty string, null and undefined', () => {
    expect(nonEmpty('')).toBe(false);
    expect(nonEmpty(null)).toBe(false);
    expect(nonEmpty(undefined)).toBe(false);
  });
});
