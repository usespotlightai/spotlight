import { OncePer } from '@shared-kernel/application/services/once-per';
import { describe, expect, it } from 'vitest';

describe('OncePer', () => {
  it('is due once for each key in its window', () => {
    const once = new OncePer(1_000);

    expect(once.due('a', new Date(0))).toBe(true);
    expect(once.due('a', new Date(999))).toBe(false);
    expect(once.due('b', new Date(999))).toBe(true);
    expect(once.due('a', new Date(1_000))).toBe(true);
  });
});
