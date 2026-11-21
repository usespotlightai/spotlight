export const WORKSPACE_PLAN_UPDATED = 'catalog.workspace-plan-updated.v1';

export type WorkspacePlanUpdatedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_PLAN_UPDATED;
  readonly workspaceId: string;
  readonly plan: string;
  readonly expiresAt: string | null;
};
