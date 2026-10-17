import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_PLAN_DELETION = Symbol('WORKSPACE_PLAN_DELETION');

export interface WorkspacePlanDeletionPort {
  deleteForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
