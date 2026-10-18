import type { WorkspaceKeysPort } from '@secrets/application/ports/workspace-keys.port';
import type { DeleteWorkspaceSecrets } from '@secrets/application/services/delete-workspace-secrets.service';
import type { PurgeRunGrants } from '@secrets/application/services/purge-run-grants.service';
import {
  WORKSPACE_DELETED,
  type WorkspaceDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const secretsSubscribers = (reactions: {
  deleting: DeleteWorkspaceSecrets;
  keys: WorkspaceKeysPort;
  runGrants: PurgeRunGrants;
}): readonly DomainEventSubscriber[] => [
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'secrets.delete-secrets-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.deleteForWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'secrets.delete-data-key-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) => reactions.keys.deleteDataKey(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'secrets.delete-run-grants-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.runGrants.deleteForWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
];
