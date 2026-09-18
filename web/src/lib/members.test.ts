import { describe, expect, it } from 'vitest';
import { sameMembers } from '@/lib/members';

describe('sameMembers', () => {
  it('holds for the same members in another order', () => {
    expect(sameMembers(['a', 'b'], ['b', 'a'])).toBe(true);
  });

  it('holds for two empty lists', () => {
    expect(sameMembers([], [])).toBe(true);
  });

  it('fails where one has a member the other lacks', () => {
    expect(sameMembers(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  it('fails where one has more members', () => {
    expect(sameMembers(['a'], ['a', 'b'])).toBe(false);
  });
});
