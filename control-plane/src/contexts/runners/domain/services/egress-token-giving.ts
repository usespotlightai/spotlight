import type { Egress } from '@runners/domain/aggregates/egress.aggregate';
import { EgressTokenSpentError } from '@runners/domain/exceptions/egress-token-spent.error';
import { EgressTokenTakenError } from '@runners/domain/exceptions/egress-token-taken.error';
import type { EgressTokenStanding } from '@runners/domain/value-objects/egress-token-standing.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export const egressTokenGivenTo = (
  egress: Egress,
  before: Egress | null,
): TokenHash | null => {
  const held = egress.isRetired ? null : egress.tokenHash;

  return held && !before?.tokenHash.equals(held) ? held : null;
};

export const refuseEgressTokenGivenBefore = (
  standing: EgressTokenStanding,
): void => {
  if (standing.held) {
    throw new EgressTokenTakenError();
  }

  if (standing.given) {
    throw new EgressTokenSpentError();
  }
};
