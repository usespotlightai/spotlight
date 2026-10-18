import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { UsedPoolTokensRepository } from '@runners/domain/repositories/used-pool-tokens.repository';
import {
  assertPoolTokenUnused,
  poolTokenUsedBy,
} from '@runners/domain/services/pool-token-use';
import { PoolTokenUsage } from '@runners/domain/value-objects/pool-token-usage.vo';

export const recordPoolTokenUse = async (
  usedTokens: UsedPoolTokensRepository,
  pools: RunnerPoolRepository,
  pool: RunnerPool,
  before: RunnerPool | null,
): Promise<void> => {
  const token = poolTokenUsedBy(pool, before);

  if (!token) {
    return;
  }

  const holder = await pools.findByTokenHash(token);

  assertPoolTokenUnused(
    PoolTokenUsage.of({
      used: await usedTokens.wasUsed(token),
      inUse: holder !== null && !holder.id.equals(pool.id),
    }),
  );
  await usedTokens.recordUse(token, pool.id);
};
