import type { PullRequestSync } from '@github/application/services/pull-request-sync.service';
import type { WorkspaceConnections } from '@github/application/services/workspace-connections.service';
import type { PullRequestRevertMerged } from '@github/domain/events/pull-request-revert-merged.event';
import type { WorkspaceDisconnected } from '@github/domain/events/workspace-disconnected.event';
import {
  WORKSPACE_DELETED,
  type WorkspaceDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const githubSubscribers = (
  sync: PullRequestSync,
  connections: WorkspaceConnections,
): readonly DomainEventSubscriber[] => [
  subscribing<PullRequestRevertMerged>(
    'github.mark-reverted-pull-request',
    ['pull-request.revert-merged'],
    (event) => sync.revertMerged(event),
  ),
  subscribing<WorkspaceDisconnected>(
    'github.purge-pull-requests-of-disconnected-workspace',
    ['workspace.disconnected'],
    async (event) => {
      await sync.uninstalled(event.workspaceId);
    },
    { callsOut: true },
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'github.disconnect-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) => connections.workspaceDeleted(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'github.purge-pull-requests-of-deleted-workspace',
    [WORKSPACE_DELETED],
    async (event) => {
      await sync.uninstalled(WorkspaceId.of(event.workspaceId));
    },
    { callsOut: true },
  ),
];
