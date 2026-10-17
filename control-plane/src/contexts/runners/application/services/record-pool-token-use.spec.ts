import { recordPoolTokenUse } from '@runners/application/services/record-pool-token-use';
import {
  aPullPool,
  aPushPool,
  hashOf,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { PoolTokenAlreadyUsedError } from '@runners/domain/exceptions/pool-token-already-used.error';
import { PoolTokenInUseError } from '@runners/domain/exceptions/pool-token-in-use.error';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { UsedPoolTokensRepository } from '@runners/domain/repositories/used-pool-tokens.repository';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { describe, expect, it, vi } from 'vitest';

const using = (ledger: { used?: boolean; inUse?: boolean } = {}) => {
  const usedTokens = {
    wasUsed: vi.fn(async () => ledger.used ?? false),
    recordUse: vi.fn(async () => {}),
  } satisfies UsedPoolTokensRepository;
  const pools = {
    findByTokenHash: vi.fn(async () =>
      ledger.inUse ? aPullPool({ id: RunnerPoolId.of('pool_other') }) : null,
    ),
  } as unknown as RunnerPoolRepository;

  return { usedTokens, pools };
};

describe('recordPoolTokenUse', () => {
  it('records a token never used before as used by the pool', async () => {
    const { usedTokens, pools } = using();
    const pool = aPullPool();

    await recordPoolTokenUse(usedTokens, pools, pool, null);

    expect(usedTokens.recordUse).toHaveBeenCalledWith(hashOf('a'), pool.id);
  });

  it('rejects a token another pool uses as in use, and records nothing', async () => {
    const { usedTokens, pools } = using({ used: true, inUse: true });

    await expect(
      recordPoolTokenUse(usedTokens, pools, aPullPool(), null),
    ).rejects.toThrow(PoolTokenInUseError);
    expect(usedTokens.recordUse).not.toHaveBeenCalled();
  });

  it('rejects a token used once before as already used, and records nothing', async () => {
    const { usedTokens, pools } = using({ used: true });

    await expect(
      recordPoolTokenUse(usedTokens, pools, aPullPool(), null),
    ).rejects.toThrow(PoolTokenAlreadyUsedError);
    expect(usedTokens.recordUse).not.toHaveBeenCalled();
  });

  it('counts the pool itself, already saved, as no other holder', async () => {
    const { usedTokens } = using();
    const pool = aPullPool();
    const pools = {
      findByTokenHash: vi.fn(async () => pool),
    } as unknown as RunnerPoolRepository;

    await recordPoolTokenUse(usedTokens, pools, pool, null);

    expect(usedTokens.recordUse).toHaveBeenCalledWith(hashOf('a'), pool.id);
  });

  it('records nothing when the pool keeps its token or provisions', async () => {
    const { usedTokens, pools } = using({ used: true, inUse: true });
    const pool = aPullPool();

    await recordPoolTokenUse(usedTokens, pools, pool, pool);
    await recordPoolTokenUse(usedTokens, pools, aPushPool(), null);

    expect(usedTokens.wasUsed).not.toHaveBeenCalled();
    expect(usedTokens.recordUse).not.toHaveBeenCalled();
  });
});
