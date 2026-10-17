import type { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export interface UsedEgressTokensRepository {
  wasUsed(token: TokenHash): Promise<boolean>;

  // Throws EgressTokenAlreadyUsedError when the token was used before. It also throws when a concurrent `recordUse` wins the race.
  recordUse(token: TokenHash, to: EgressId): Promise<void>;
}
