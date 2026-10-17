import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { PoolTokenAlreadyUsedError } from '@runners/domain/exceptions/pool-token-already-used.error';
import { PoolTokenInUseError } from '@runners/domain/exceptions/pool-token-in-use.error';
import type { PoolTokenUsage } from '@runners/domain/value-objects/pool-token-usage.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export const poolTokenUsedBy = (
  pool: RunnerPool,
  before: RunnerPool | null,
): TokenHash | null => {
  const current = pool.isDeleted ? null : pool.tokenHash;

  return current && !before?.tokenHash?.equals(current) ? current : null;
};

export const assertPoolTokenUnused = (usage: PoolTokenUsage): void => {
  if (usage.inUse) {
    throw new PoolTokenInUseError();
  }

  if (usage.used) {
    throw new PoolTokenAlreadyUsedError();
  }
};
