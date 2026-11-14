import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunnerRepository {
  add(runner: Runner): Promise<void>;

  save(runner: Runner): Promise<void>;

  find(id: RunnerId): Promise<Runner | null>;

  findByTokenHash(hash: TokenHash): Promise<Runner | null>;

  findByEgressTokenHash(hash: TokenHash): Promise<Runner | null>;

  findByProxyCredentialHash(hash: TokenHash): Promise<Runner | null>;

  aliveIn(poolId: PoolId, now: Date): Promise<readonly Runner[]>;

  aliveOnHostsIn(
    workspaceId: WorkspaceId,
    now: Date,
  ): Promise<readonly Runner[]>;

  findByWork(work: RunnerWork): Promise<readonly Runner[]>;
}
