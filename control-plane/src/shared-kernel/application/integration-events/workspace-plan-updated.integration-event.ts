import type { PlanPublished } from '@shared-kernel/application/integration-events/workspace-plan-created.integration-event';

export const WORKSPACE_PLAN_UPDATED = 'catalog.workspace-plan-updated.v1';

export type WorkspacePlanUpdatedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_PLAN_UPDATED;
  readonly workspaceId: string;
  readonly plan: PlanPublished;
  readonly expiresAt: string | null;
};
