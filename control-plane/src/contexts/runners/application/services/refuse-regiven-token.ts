import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { refuseTokenGivenBefore } from '@runners/domain/services/token-giving';

export const refuseRegivenToken = async (
  pools: RunnerPoolRepository,
  pool: RunnerPool,
): Promise<void> => {
  if (pool.tokenGiven) {
    refuseTokenGivenBefore(await pools.tokenStanding(pool.tokenGiven));
  }
};
