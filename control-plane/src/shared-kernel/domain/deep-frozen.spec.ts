import { deepFrozen } from '@shared-kernel/domain/deep-frozen';
import { describe, expect, it } from 'vitest';

describe('deepFrozen', () => {
  it('freezes a value all the way down and hands the same value back', () => {
    const value = { permissions: { allow: ['Read'] }, native: [{ on: true }] };

    expect(deepFrozen(value)).toBe(value);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.permissions.allow)).toBe(true);
    expect(Object.isFrozen(value.native[0])).toBe(true);
  });

  it('passes a plain value through', () => {
    expect(deepFrozen('opened')).toBe('opened');
    expect(deepFrozen(null)).toBeNull();
  });
});
