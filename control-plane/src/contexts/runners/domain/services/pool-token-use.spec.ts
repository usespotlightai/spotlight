import {
  aPullPool,
  aPushPool,
  hashOf,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { PoolTokenAlreadyUsedError } from '@runners/domain/exceptions/pool-token-already-used.error';
import { PoolTokenInUseError } from '@runners/domain/exceptions/pool-token-in-use.error';
import {
  assertPoolTokenUnused,
  poolTokenUsedBy,
} from '@runners/domain/services/pool-token-use';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { PoolTokenUsage } from '@runners/domain/value-objects/pool-token-usage.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { describe, expect, it } from 'vitest';

describe('poolTokenUsedBy', () => {
  const pool = aPullPool({ tokenVersion: 1 });
  const pulled = (tokenHash: TokenHash | null, tokenVersion: number) =>
    pool.update(
      {
        key: PoolKey.of('ephemeral'),
        labels: RunnerLabels.of(['gpu']),
        maxRuns: null,
      },
      { mode: 'pull', tokenHash, tokenVersion },
      changeActorIn(),
    );

  it('uses the token a pool is created with, and none for a pool that provisions', () => {
    expect(poolTokenUsedBy(pool, null)?.equals(hashOf('a'))).toBe(true);
    expect(poolTokenUsedBy(aPushPool(), null)).toBeNull();
  });

  it('uses a token only when the pool is rotated to a new one', () => {
    expect(
      poolTokenUsedBy(pulled(hashOf('c'), 2), pool)?.equals(hashOf('c')),
    ).toBe(true);
    expect(poolTokenUsedBy(pulled(null, 1), pool)).toBeNull();
    expect(poolTokenUsedBy(pulled(hashOf('a'), 2), pool)).toBeNull();
  });

  it('uses no token for a pool being deleted', () => {
    expect(poolTokenUsedBy(pool.delete(changeActorIn()), pool)).toBeNull();
  });
});

describe('assertPoolTokenUnused', () => {
  it('lets a pool use a token never used before', () => {
    expect(() =>
      assertPoolTokenUnused(PoolTokenUsage.of({ used: false, inUse: false })),
    ).not.toThrow();
  });

  it('rejects a token another pool uses now as in use', () => {
    expect(() =>
      assertPoolTokenUnused(PoolTokenUsage.of({ used: true, inUse: true })),
    ).toThrow(PoolTokenInUseError);
  });

  it('rejects a token no pool uses any more as already used', () => {
    expect(() =>
      assertPoolTokenUnused(PoolTokenUsage.of({ used: true, inUse: false })),
    ).toThrow(PoolTokenAlreadyUsedError);
  });
});
