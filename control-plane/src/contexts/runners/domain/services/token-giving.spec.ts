import { PoolTokenSpentError } from '@runners/domain/exceptions/pool-token-spent.error';
import { PoolTokenTakenError } from '@runners/domain/exceptions/pool-token-taken.error';
import { refuseTokenGivenBefore } from '@runners/domain/services/token-giving';
import { PoolTokenStanding } from '@runners/domain/value-objects/pool-token-standing.vo';
import { describe, expect, it } from 'vitest';

describe('refuseTokenGivenBefore', () => {
  it('lets a pool be given a token never given before', () => {
    expect(() =>
      refuseTokenGivenBefore(
        PoolTokenStanding.of({ given: false, held: false }),
      ),
    ).not.toThrow();
  });

  it('refuses a token a pool holds now as taken', () => {
    expect(() =>
      refuseTokenGivenBefore(PoolTokenStanding.of({ given: true, held: true })),
    ).toThrow(PoolTokenTakenError);
  });

  it('refuses a token no pool holds any more as spent', () => {
    expect(() =>
      refuseTokenGivenBefore(
        PoolTokenStanding.of({ given: true, held: false }),
      ),
    ).toThrow(PoolTokenSpentError);
  });
});
