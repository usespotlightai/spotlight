import type { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_PLANS = Symbol('WORKSPACE_PLANS');

export interface WorkspacePlansPort {
  of(workspaceId: WorkspaceId): Promise<PlanTerm>;

  // The stored plans of the workspaces named, by workspace id. A workspace that is not there has the free plan.
  storedOf(
    workspaceIds: readonly WorkspaceId[],
  ): Promise<ReadonlyMap<string, PlanTerm>>;
}
