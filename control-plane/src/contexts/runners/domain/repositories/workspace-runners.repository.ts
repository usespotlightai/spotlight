import type { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import type { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface WorkspaceRunnersRepository {
  add(declared: WorkspaceRunners): Promise<void>;

  save(declared: WorkspaceRunners): Promise<void>;

  find(id: WorkspaceRunnersId): Promise<WorkspaceRunners | null>;

  declaredIn(workspaceId: WorkspaceId): Promise<WorkspaceRunners | null>;
}
