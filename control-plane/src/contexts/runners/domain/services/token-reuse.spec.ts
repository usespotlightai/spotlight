import { anEgress } from '@runners/domain/aggregates/egress.fake-spec';
import {
  aPullPool,
  aPushPool,
  hashOf,
  POOL_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { EgressTokenAlreadyUsedError } from '@runners/domain/exceptions/egress-token-already-used.error';
import { EgressTokenInUseError } from '@runners/domain/exceptions/egress-token-in-use.error';
import { PoolTokenAlreadyUsedError } from '@runners/domain/exceptions/pool-token-already-used.error';
import { PoolTokenInUseError } from '@runners/domain/exceptions/pool-token-in-use.error';
import {
  assertTokenFree,
  tokenTakenBy,
} from '@runners/domain/services/token-reuse';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import { EgressKey } from '@runners/domain/value-objects/egress-key.vo';
import { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { TokenHolder } from '@runners/domain/value-objects/token-holder.vo';
import { TokenUsage } from '@runners/domain/value-objects/token-usage.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { describe, expect, it } from 'vitest';

describe('tokenTakenBy', () => {
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

  it('takes the token a pool is created with, and none for a pool that provisions', () => {
    expect(tokenTakenBy(pool, null)?.equals(hashOf('a'))).toBe(true);
    expect(tokenTakenBy(aPushPool(), null)).toBeNull();
  });

  it('takes a token only when the pool is rotated to a new one', () => {
    expect(
      tokenTakenBy(pulled(hashOf('c'), 2), pool)?.equals(hashOf('c')),
    ).toBe(true);
    expect(tokenTakenBy(pulled(null, 1), pool)).toBeNull();
    expect(tokenTakenBy(pulled(hashOf('a'), 2), pool)).toBeNull();
  });

  it('takes no token for a pool being deleted', () => {
    expect(tokenTakenBy(pool.delete(changeActorIn()), pool)).toBeNull();
  });

  it('takes the token an egress is created with or rotated to, and none it keeps', () => {
    const egress = anEgress();
    const rotated = (tokenHash: TokenHash | null, tokenVersion: number) =>
      egress.update(
        {
          key: EgressKey.of('shared'),
          url: EgressUrl.of('https://egress.example.com'),
        },
        { tokenHash, tokenVersion },
        changeActorIn(),
      );

    expect(tokenTakenBy(egress, null)?.equals(hashOf('9'))).toBe(true);
    expect(
      tokenTakenBy(rotated(hashOf('8'), 2), egress)?.equals(hashOf('8')),
    ).toBe(true);
    expect(tokenTakenBy(rotated(null, 1), egress)).toBeNull();
  });
});

describe('assertTokenFree', () => {
  const pool = TokenHolder.pool(POOL_ID);
  const egress = TokenHolder.egress(EgressId.of('egress_1'));

  it('lets a pool or an egress take a token never used before', () => {
    const fresh = TokenUsage.of({ used: false, heldByAnother: false });

    expect(() => assertTokenFree(pool, fresh)).not.toThrow();
    expect(() => assertTokenFree(egress, fresh)).not.toThrow();
  });

  it('rejects a token another holder of the same kind holds now as in use', () => {
    const held = TokenUsage.of({ used: true, heldByAnother: true });

    expect(() => assertTokenFree(pool, held)).toThrow(PoolTokenInUseError);
    expect(() => assertTokenFree(egress, held)).toThrow(EgressTokenInUseError);
  });

  it('rejects a token no holder holds any more as already used', () => {
    const released = TokenUsage.of({ used: true, heldByAnother: false });

    expect(() => assertTokenFree(pool, released)).toThrow(
      PoolTokenAlreadyUsedError,
    );
    expect(() => assertTokenFree(egress, released)).toThrow(
      EgressTokenAlreadyUsedError,
    );
  });

  it('rejects a token another holder took at the same time as in use', () => {
    expect(() => assertTokenFree(pool, TokenUsage.takenConcurrently())).toThrow(
      PoolTokenInUseError,
    );
  });
});
