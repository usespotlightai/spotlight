import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export interface UsedPoolTokensRepository {
  wasUsed(token: TokenHash): Promise<boolean>;

  // Throws PoolTokenAlreadyUsedError when the token was used before. It also throws when a concurrent `recordUse` wins the race.
  recordUse(token: TokenHash, to: RunnerPoolId): Promise<void>;
}
