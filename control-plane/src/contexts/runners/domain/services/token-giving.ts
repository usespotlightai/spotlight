import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { PoolTokenSpentError } from '@runners/domain/exceptions/pool-token-spent.error';
import { PoolTokenTakenError } from '@runners/domain/exceptions/pool-token-taken.error';
import type { PoolTokenUsage } from '@runners/domain/value-objects/pool-token-usage.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export const tokenGivenTo = (
  pool: RunnerPool,
  before: RunnerPool | null,
): TokenHash | null => {
  const current = pool.isRetired ? null : pool.tokenHash;

  return current && !before?.tokenHash?.equals(current) ? current : null;
};

export const assertPoolTokenUnused = (usage: PoolTokenUsage): void => {
  if (usage.inUse) {
    throw new PoolTokenTakenError();
  }

  if (usage.given) {
    throw new PoolTokenSpentError();
  }
};
