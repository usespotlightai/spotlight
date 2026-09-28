import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunnerPoolRepository {
  add(pool: RunnerPool): Promise<void>;

  save(pool: RunnerPool): Promise<void>;

  find(id: RunnerPoolId): Promise<RunnerPool | null>;

  // Must lock the pool until the surrounding transaction ends, so runners started under it are counted one at a time.
  findForStart(id: RunnerPoolId): Promise<RunnerPool | null>;

  findByTokenHash(hash: TokenHash): Promise<RunnerPool | null>;

  inWorkspace(workspaceId: WorkspaceId): Promise<readonly RunnerPool[]>;
}
