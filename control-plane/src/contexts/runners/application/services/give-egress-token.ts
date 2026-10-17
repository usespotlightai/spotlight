import type { Egress } from '@runners/domain/aggregates/egress.aggregate';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { GivenEgressTokensRepository } from '@runners/domain/repositories/given-egress-tokens.repository';
import {
  egressTokenGivenTo,
  refuseEgressTokenGivenBefore,
} from '@runners/domain/services/egress-token-giving';
import { EgressTokenUsage } from '@runners/domain/value-objects/egress-token-usage.vo';

export const giveEgressToken = async (
  given: GivenEgressTokensRepository,
  egresses: EgressRepository,
  egress: Egress,
  before: Egress | null,
): Promise<void> => {
  const token = egressTokenGivenTo(egress, before);

  if (!token) {
    return;
  }

  const holder = await egresses.findByTokenHash(token);

  refuseEgressTokenGivenBefore(
    EgressTokenUsage.of({
      given: await given.wasGiven(token),
      inUse: holder !== null && !holder.id.equals(egress.id),
    }),
  );
  await given.give(token, egress.id);
};
