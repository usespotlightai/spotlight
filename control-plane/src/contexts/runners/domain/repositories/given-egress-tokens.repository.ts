import type { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export interface GivenEgressTokensRepository {
  wasGiven(token: TokenHash): Promise<boolean>;

  // Throws EgressTokenSpentError when the token was given before. It also throws when a concurrent `give` wins the race.
  give(token: TokenHash, to: EgressId): Promise<void>;
}
