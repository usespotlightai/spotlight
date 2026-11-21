import type { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PLAN_TERMS = Symbol('PLAN_TERMS');

// A workspace without a stored plan has the free plan.
export interface PlanTermsPort {
  of(workspaceId: WorkspaceId): Promise<PlanTerm>;

  // One term for each workspace, in the order given.
  ofWorkspaces(
    workspaceIds: readonly WorkspaceId[],
  ): Promise<readonly PlanTerm[]>;
}
