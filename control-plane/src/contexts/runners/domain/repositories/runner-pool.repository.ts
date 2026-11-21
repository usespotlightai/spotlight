import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunnerPoolRepository {
  add(pool: RunnerPool): Promise<void>;

  save(pool: RunnerPool): Promise<void>;

  find(id: PoolId): Promise<RunnerPool | null>;

  // Must lock the pool until the outer transaction ends, so that runners started in the pool are counted one at a time.
  findForStart(id: PoolId): Promise<RunnerPool | null>;

  findByTokenHash(hash: TokenHash): Promise<RunnerPool | null>;

  inWorkspace(workspaceId: WorkspaceId): Promise<readonly RunnerPool[]>;

  findAllByWorkspaces(
    workspaceIds: readonly WorkspaceId[],
  ): Promise<readonly RunnerPool[]>;

  // The pools of every workspace that have this key.
  findAllByKey(key: PoolKey): Promise<readonly RunnerPool[]>;

  // As find, but not the platform pool, which the workspace does not own.
  findOwned(id: PoolId): Promise<RunnerPool | null>;

  // As inWorkspace, but not the platform pool, which the workspace does not own.
  listOwned(workspaceId: WorkspaceId): Promise<readonly RunnerPool[]>;
}
