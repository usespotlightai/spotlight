import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { PoolTokenSpentError } from '@runners/domain/exceptions/pool-token-spent.error';
import { PoolTokenTakenError } from '@runners/domain/exceptions/pool-token-taken.error';
import type { PoolTokenStanding } from '@runners/domain/value-objects/pool-token-standing.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export const tokenGivenTo = (
  pool: RunnerPool,
  before: RunnerPool | null,
): TokenHash | null => {
  const current = pool.isRetired ? null : pool.tokenHash;

  return current && !before?.tokenHash?.equals(current) ? current : null;
};

export const refuseTokenGivenBefore = (standing: PoolTokenStanding): void => {
  if (standing.inUse) {
    throw new PoolTokenTakenError();
  }

  if (standing.given) {
    throw new PoolTokenSpentError();
  }
};
