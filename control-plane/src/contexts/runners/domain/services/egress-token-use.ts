import type { Egress } from '@runners/domain/aggregates/egress.aggregate';
import { EgressTokenAlreadyUsedError } from '@runners/domain/exceptions/egress-token-already-used.error';
import { EgressTokenInUseError } from '@runners/domain/exceptions/egress-token-in-use.error';
import type { EgressTokenUsage } from '@runners/domain/value-objects/egress-token-usage.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export const egressTokenUsedBy = (
  egress: Egress,
  before: Egress | null,
): TokenHash | null => {
  const current = egress.isDeleted ? null : egress.tokenHash;

  return current && !before?.tokenHash.equals(current) ? current : null;
};

export const assertEgressTokenUnused = (usage: EgressTokenUsage): void => {
  if (usage.inUse) {
    throw new EgressTokenInUseError();
  }

  if (usage.used) {
    throw new EgressTokenAlreadyUsedError();
  }
};
