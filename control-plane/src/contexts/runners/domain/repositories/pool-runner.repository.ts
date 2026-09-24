import type { PoolRunner } from '@runners/domain/aggregates/pool-runner.aggregate';
import type { PoolWork } from '@runners/domain/value-objects/pool-work.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export interface PoolRunnerRepository {
  add(runner: PoolRunner): Promise<void>;

  save(runner: PoolRunner): Promise<void>;

  find(id: RunnerId): Promise<PoolRunner | null>;

  findByTokenHash(hash: TokenHash): Promise<PoolRunner | null>;

  standingIn(poolId: RunnerPoolId, now: Date): Promise<readonly PoolRunner[]>;

  holding(work: PoolWork): Promise<readonly PoolRunner[]>;
}
