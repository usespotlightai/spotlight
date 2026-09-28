import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_PLAN_FORGETTING = Symbol('WORKSPACE_PLAN_FORGETTING');

export interface WorkspacePlanForgettingPort {
  forget(workspaceId: WorkspaceId): Promise<void>;
}
