import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export interface GivenPoolTokensRepository {
  wasGiven(token: TokenHash): Promise<boolean>;

  // Throws PoolTokenSpentError when the token was given before. It also throws when a concurrent `give` wins the race.
  give(token: TokenHash, to: RunnerPoolId): Promise<void>;
}
