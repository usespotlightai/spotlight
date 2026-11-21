export const WORKSPACE_PLAN_CREATED = 'catalog.workspace-plan-created.v1';

export type PlanPublished = 'free' | 'team' | 'enterprise';

export type WorkspacePlanCreatedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_PLAN_CREATED;
  readonly workspaceId: string;
  readonly plan: PlanPublished;
  readonly expiresAt: string | null;
};
