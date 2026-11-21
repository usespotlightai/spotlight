import type { WorkspacePlan } from '@catalog/domain/aggregates/workspace-plan.aggregate';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_PLANS = Symbol('WORKSPACE_PLANS');

export interface WorkspacePlanRepository {
  find(workspaceId: WorkspaceId): Promise<WorkspacePlan | null>;

  add(plan: WorkspacePlan): Promise<void>;

  save(plan: WorkspacePlan): Promise<void>;
}
