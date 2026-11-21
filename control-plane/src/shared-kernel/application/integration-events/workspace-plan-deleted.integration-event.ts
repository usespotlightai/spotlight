// The workspace has the free plan again.
export const WORKSPACE_PLAN_DELETED = 'catalog.workspace-plan-deleted.v1';

export type WorkspacePlanDeletedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_PLAN_DELETED;
  readonly workspaceId: string;
};
