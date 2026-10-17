import type { Egress } from '@runners/domain/aggregates/egress.aggregate';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { UsedEgressTokensRepository } from '@runners/domain/repositories/used-egress-tokens.repository';
import {
  assertEgressTokenUnused,
  egressTokenUsedBy,
} from '@runners/domain/services/egress-token-use';
import { EgressTokenUsage } from '@runners/domain/value-objects/egress-token-usage.vo';

export const recordEgressTokenUse = async (
  usedTokens: UsedEgressTokensRepository,
  egresses: EgressRepository,
  egress: Egress,
  before: Egress | null,
): Promise<void> => {
  const token = egressTokenUsedBy(egress, before);

  if (!token) {
    return;
  }

  const holder = await egresses.findByTokenHash(token);

  assertEgressTokenUnused(
    EgressTokenUsage.of({
      used: await usedTokens.wasUsed(token),
      inUse: holder !== null && !holder.id.equals(egress.id),
    }),
  );
  await usedTokens.recordUse(token, egress.id);
};
