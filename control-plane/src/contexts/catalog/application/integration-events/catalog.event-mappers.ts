import type { WorkspacePlanCreated } from '@catalog/domain/events/workspace-plan-created.event';
import type { WorkspacePlanDeleted } from '@catalog/domain/events/workspace-plan-deleted.event';
import type { WorkspacePlanUpdated } from '@catalog/domain/events/workspace-plan-updated.event';
import {
  WORKSPACE_PLAN_CREATED,
  type WorkspacePlanCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-plan-created.integration-event';
import {
  WORKSPACE_PLAN_DELETED,
  type WorkspacePlanDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-plan-deleted.integration-event';
import {
  WORKSPACE_PLAN_UPDATED,
  type WorkspacePlanUpdatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-plan-updated.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const CATALOG_EVENT_MAPPERS = [
  mapping<WorkspacePlanCreated>(
    'workspace-plan.created',
    (event): WorkspacePlanCreatedIntegrationEvent => ({
      kind: WORKSPACE_PLAN_CREATED,
      workspaceId: event.workspaceId.value,
      plan: event.term.plan.value,
      expiresAt: event.term.expiresAt?.toISOString() ?? null,
    }),
  ),
  mapping<WorkspacePlanUpdated>(
    'workspace-plan.updated',
    (event): WorkspacePlanUpdatedIntegrationEvent => ({
      kind: WORKSPACE_PLAN_UPDATED,
      workspaceId: event.workspaceId.value,
      plan: event.term.plan.value,
      expiresAt: event.term.expiresAt?.toISOString() ?? null,
    }),
  ),
  mapping<WorkspacePlanDeleted>(
    'workspace-plan.deleted',
    (event): WorkspacePlanDeletedIntegrationEvent => ({
      kind: WORKSPACE_PLAN_DELETED,
      workspaceId: event.workspaceId.value,
    }),
  ),
] as const;
