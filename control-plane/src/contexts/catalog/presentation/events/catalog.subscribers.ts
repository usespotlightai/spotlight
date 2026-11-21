import type { CatalogCallLedgerPort } from '@catalog/application/ports/catalog-call-ledger.port';
import type { DeleteWorkspacePlanOfDeletedWorkspace } from '@catalog/application/services/delete-workspace-plan-of-deleted-workspace.service';
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
  deleting: DeleteWorkspacePlanOfDeletedWorkspace;
  calls: CatalogCallLedgerPort;
}): readonly DomainEventSubscriber[] => [
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'catalog.delete-plan-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.deleteForWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'catalog.delete-calls-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.calls.deleteForWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
];
