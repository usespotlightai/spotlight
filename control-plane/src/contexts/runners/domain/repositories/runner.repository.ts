import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export interface RunnerRepository {
  add(runner: Runner): Promise<void>;

  save(runner: Runner): Promise<void>;

  find(id: RunnerId): Promise<Runner | null>;

  findByTokenHash(hash: TokenHash): Promise<Runner | null>;
}
