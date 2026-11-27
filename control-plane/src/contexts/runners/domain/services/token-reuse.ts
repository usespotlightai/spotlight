import { EgressTokenAlreadyUsedError } from '@runners/domain/exceptions/egress-token-already-used.error';
import { EgressTokenInUseError } from '@runners/domain/exceptions/egress-token-in-use.error';
import { PoolTokenAlreadyUsedError } from '@runners/domain/exceptions/pool-token-already-used.error';
import { PoolTokenInUseError } from '@runners/domain/exceptions/pool-token-in-use.error';
import type { TokenHolder } from '@runners/domain/value-objects/token-holder.vo';
import type { TokenUsage } from '@runners/domain/value-objects/token-usage.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export interface TokenBearer {
  readonly isDeleted: boolean;
  readonly tokenHash: TokenHash | null;
}

export const tokenTakenBy = (
  bearer: TokenBearer,
  before: TokenBearer | null,
): TokenHash | null => {
  const current = bearer.isDeleted ? null : bearer.tokenHash;

  return current && !before?.tokenHash?.equals(current) ? current : null;
};

export const assertTokenFree = (
  holder: TokenHolder,
  usage: TokenUsage,
): void => {
  if (usage.heldByAnother) {
    throw holder.kind === 'pool'
      ? new PoolTokenInUseError()
      : new EgressTokenInUseError();
  }

  if (usage.used) {
    throw holder.kind === 'pool'
      ? new PoolTokenAlreadyUsedError()
      : new EgressTokenAlreadyUsedError();
  }
};
