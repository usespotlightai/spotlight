import type { PullRequestSync } from '@github/application/services/pull-request-sync.service';
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
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'github.purge-pull-requests-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) => sync.workspaceDeleted(WorkspaceId.of(event.workspaceId)),
  ),
];
