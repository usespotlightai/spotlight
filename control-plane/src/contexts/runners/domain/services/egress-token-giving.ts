import type { Egress } from '@runners/domain/aggregates/egress.aggregate';
import { EgressTokenSpentError } from '@runners/domain/exceptions/egress-token-spent.error';
import { EgressTokenTakenError } from '@runners/domain/exceptions/egress-token-taken.error';
import type { EgressTokenUsage } from '@runners/domain/value-objects/egress-token-usage.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export const egressTokenGivenTo = (
  egress: Egress,
  before: Egress | null,
): TokenHash | null => {
  const current = egress.isRetired ? null : egress.tokenHash;

  return current && !before?.tokenHash.equals(current) ? current : null;
};

export const refuseEgressTokenGivenBefore = (usage: EgressTokenUsage): void => {
  if (usage.inUse) {
    throw new EgressTokenTakenError();
  }

  if (usage.given) {
    throw new EgressTokenSpentError();
  }
};
