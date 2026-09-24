import type { WorkspacePlan } from '@catalog/domain/value-objects/workspace-plan.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface WorkspacePlanRepository {
  of(workspaceId: WorkspaceId): Promise<WorkspacePlan>;
  forget(workspaceId: WorkspaceId): Promise<void>;
}
