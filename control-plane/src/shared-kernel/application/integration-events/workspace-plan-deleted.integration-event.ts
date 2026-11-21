// The workspace plan is gone: the workspace has the free plan again, or the workspace is deleted. Catalog raises it in both cases.
export const WORKSPACE_PLAN_DELETED = 'catalog.workspace-plan-deleted.v1';

export type WorkspacePlanDeletedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_PLAN_DELETED;
  readonly workspaceId: string;
};
