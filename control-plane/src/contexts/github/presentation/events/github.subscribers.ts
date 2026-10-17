import type { RecordPullRequests } from '@github/application/services/record-pull-requests.service';
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
  recording: RecordPullRequests,
): readonly DomainEventSubscriber[] => [
  subscribing<PullRequestRevertMerged>(
    'github.mark-reverted-pull-request',
    ['pull-request.revert-merged'],
    (event) => recording.revertMerged(event),
  ),
  subscribing<WorkspaceDisconnected>(
    'github.purge-pull-requests-of-disconnected-workspace',
    ['workspace.disconnected'],
    async (event) => {
      await recording.uninstalled(event.workspaceId);
    },
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'github.purge-pull-requests-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) => recording.workspaceDeleted(WorkspaceId.of(event.workspaceId)),
  ),
];
