import { PoolTokenSpentError } from '@runners/domain/exceptions/pool-token-spent.error';
import { PoolTokenTakenError } from '@runners/domain/exceptions/pool-token-taken.error';
import type { PoolTokenStanding } from '@runners/domain/value-objects/pool-token-standing.vo';

export const refuseTokenGivenBefore = (standing: PoolTokenStanding): void => {
  if (standing.held) {
    throw new PoolTokenTakenError();
  }

  if (standing.given) {
    throw new PoolTokenSpentError();
  }
};
