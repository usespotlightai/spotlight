import { deepFrozen } from '@shared-kernel/domain/deep-frozen';
import { describe, expect, it } from 'vitest';

describe('deepFrozen', () => {
  it('freezes a value all the way down and hands the same value back', () => {
    const held = { permissions: { allow: ['Read'] }, native: [{ on: true }] };

    expect(deepFrozen(held)).toBe(held);
    expect(Object.isFrozen(held)).toBe(true);
    expect(Object.isFrozen(held.permissions.allow)).toBe(true);
    expect(Object.isFrozen(held.native[0])).toBe(true);
  });

  it('passes a plain value through', () => {
    expect(deepFrozen('opened')).toBe('opened');
    expect(deepFrozen(null)).toBeNull();
  });
});
