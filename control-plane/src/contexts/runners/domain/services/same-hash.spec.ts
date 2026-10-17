import { hashOf } from '@runners/domain/aggregates/runner-pool.fake-spec';
import { sameHash } from '@runners/domain/services/same-hash';
import { describe, expect, it } from 'vitest';

describe('sameHash', () => {
  it('tells the same hash from another', () => {
    expect(sameHash(hashOf('a'), hashOf('a'))).toBe(true);
    expect(sameHash(hashOf('a'), hashOf('b'))).toBe(false);
  });
});
