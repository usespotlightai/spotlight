import type { WorkspaceKeysPort } from '@secrets/application/ports/workspace-keys.port';
import type { AbandonWorkspaceSecrets } from '@secrets/application/services/abandon-workspace-secrets.service';
import type { ForgetRunGrants } from '@secrets/application/services/forget-run-grants.service';
import {
  WORKSPACE_CLOSED,
  type WorkspaceClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-closed.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const secretsSubscribers = (reactions: {
  abandoning: AbandonWorkspaceSecrets;
  keys: WorkspaceKeysPort;
  runGrants: ForgetRunGrants;
}): readonly DomainEventSubscriber[] => [
  subscribing<WorkspaceClosedIntegrationEvent>(
    'secrets.abandon-secrets-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) => reactions.abandoning.of(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'secrets.forget-data-key-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) => reactions.keys.forget(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'secrets.forget-run-grants-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) =>
      reactions.runGrants.ofWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
];
