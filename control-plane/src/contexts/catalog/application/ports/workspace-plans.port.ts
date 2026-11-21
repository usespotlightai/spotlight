import type { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_PLANS = Symbol('WORKSPACE_PLANS');

// A workspace without a stored plan has the free plan.
export interface WorkspacePlansPort {
  of(workspaceId: WorkspaceId): Promise<PlanTerm>;

  // One term for each workspace, in the order given.
  ofEach(workspaceIds: readonly WorkspaceId[]): Promise<readonly PlanTerm[]>;
}
