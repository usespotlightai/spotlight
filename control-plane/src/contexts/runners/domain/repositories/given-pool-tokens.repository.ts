import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export interface GivenPoolTokensRepository {
  wasGiven(token: TokenHash): Promise<boolean>;

  // Throws PoolTokenSpentError when the token was given before, however the race with another giving ends.
  give(token: TokenHash, to: RunnerPoolId): Promise<void>;
}
