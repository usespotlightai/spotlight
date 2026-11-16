import type { DeleteInferenceEndpointOfDeletedWorkspace } from '@inference/application/services/delete-inference-endpoint-of-deleted-workspace.service';
import {
  WORKSPACE_DELETED,
  type WorkspaceDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const inferenceSubscribers = (reactions: {
  deleting: DeleteInferenceEndpointOfDeletedWorkspace;
}): readonly DomainEventSubscriber[] => [
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'inference.delete-endpoint-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.deleteForWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
];
