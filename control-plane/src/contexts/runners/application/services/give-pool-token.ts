import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { GivenPoolTokensRepository } from '@runners/domain/repositories/given-pool-tokens.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import {
  assertPoolTokenUnused,
  tokenGivenTo,
} from '@runners/domain/services/token-giving';
import { PoolTokenUsage } from '@runners/domain/value-objects/pool-token-usage.vo';

export const givePoolToken = async (
  given: GivenPoolTokensRepository,
  pools: RunnerPoolRepository,
  pool: RunnerPool,
  before: RunnerPool | null,
): Promise<void> => {
  const token = tokenGivenTo(pool, before);

  if (!token) {
    return;
  }

  const holder = await pools.findByTokenHash(token);

  assertPoolTokenUnused(
    PoolTokenUsage.of({
      given: await given.wasGiven(token),
      inUse: holder !== null && !holder.id.equals(pool.id),
    }),
  );
  await given.give(token, pool.id);
};
