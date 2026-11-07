import type { CatalogCallLedgerPort } from '@catalog/application/ports/catalog-call-ledger.port';
import type { WorkspacePlanDeletionPort } from '@catalog/application/ports/workspace-plan-deletion.port';
import {
  WORKSPACE_DELETED,
  type WorkspaceDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const catalogSubscribers = (reactions: {
  plans: WorkspacePlanDeletionPort;
  calls: CatalogCallLedgerPort;
}): readonly DomainEventSubscriber[] => [
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'catalog.delete-plan-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.plans.deleteForWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'catalog.delete-calls-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.calls.deleteForWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
];
