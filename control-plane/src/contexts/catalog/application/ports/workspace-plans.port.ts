import type { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_PLANS = Symbol('WORKSPACE_PLANS');

export interface WorkspacePlansPort {
  of(workspaceId: WorkspaceId): Promise<PlanTerm>;

  // Every workspace named, by its id; one without a stored plan has the free plan.
  ofEach(
    workspaceIds: readonly WorkspaceId[],
  ): Promise<ReadonlyMap<string, PlanTerm>>;
}
