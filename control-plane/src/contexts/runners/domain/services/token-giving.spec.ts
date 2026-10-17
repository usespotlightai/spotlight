import {
  aPullPool,
  aPushPool,
  hashOf,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { PoolTokenSpentError } from '@runners/domain/exceptions/pool-token-spent.error';
import { PoolTokenTakenError } from '@runners/domain/exceptions/pool-token-taken.error';
import {
  refuseTokenGivenBefore,
  tokenGivenTo,
} from '@runners/domain/services/token-giving';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { PoolTokenStanding } from '@runners/domain/value-objects/pool-token-standing.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { describe, expect, it } from 'vitest';

describe('tokenGivenTo', () => {
  const pool = aPullPool({ tokenVersion: 1 });
  const pulled = (tokenHash: TokenHash | null, tokenVersion: number) =>
    pool.redefinedAs(
      {
        key: PoolKey.of('ephemeral'),
        labels: RunnerLabels.of(['gpu']),
        maxRuns: null,
      },
      { mode: 'pull', tokenHash, tokenVersion },
      attributedIn(),
    );

  it('gives the token a pool is defined with, and none to a pool that provisions', () => {
    expect(tokenGivenTo(pool, null)?.equals(hashOf('a'))).toBe(true);
    expect(tokenGivenTo(aPushPool(), null)).toBeNull();
  });

  it('gives a token only when the pool is rotated to a new one', () => {
    expect(
      tokenGivenTo(pulled(hashOf('c'), 2), pool)?.equals(hashOf('c')),
    ).toBe(true);
    expect(tokenGivenTo(pulled(null, 1), pool)).toBeNull();
    expect(tokenGivenTo(pulled(hashOf('a'), 2), pool)).toBeNull();
  });

  it('gives no token to a pool being retired', () => {
    expect(tokenGivenTo(pool.retire(attributedIn()), pool)).toBeNull();
  });
});

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
