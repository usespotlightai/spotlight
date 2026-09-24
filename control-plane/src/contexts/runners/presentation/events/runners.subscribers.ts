import type { AbandonWorkspaceRunners } from '@runners/application/services/abandon-workspace-runners.service';
import type { RevokeTrustedRunners } from '@runners/application/services/revoke-trusted-runners.service';
import type { RunnerTrustWithdrawn } from '@runners/domain/events/runner-trust-withdrawn.event';
import {
  WORKSPACE_CLOSED,
  type WorkspaceClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-closed.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const runnersSubscribers = (reactions: {
  revoking: RevokeTrustedRunners;
  abandoning: AbandonWorkspaceRunners;
}): readonly DomainEventSubscriber[] => [
  subscribing<RunnerTrustWithdrawn>(
    'runners.revoke-runners-of-withdrawn-trust',
    ['runner-trust.withdrawn'],
    (event) => reactions.revoking.withdrawn(event.trustId),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'runners.revoke-runners-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) =>
      reactions.abandoning.runnersOf(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'runners.withdraw-trusts-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) => reactions.abandoning.trustsOf(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'runners.drop-runners-declared-by-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) =>
      reactions.abandoning.declarationOf(WorkspaceId.of(event.workspaceId)),
  ),
];
