import type { AbandonWorkspaceRunners } from '@runners/application/services/abandon-workspace-runners.service';
import type { ForgetHosts } from '@runners/application/services/forget-hosts.service';
import type { RunnerPoolRetired } from '@runners/domain/events/runner-pool-retired.event';
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
  abandoning: AbandonWorkspaceRunners;
  forgetting: ForgetHosts;
}): readonly DomainEventSubscriber[] => [
  subscribing<RunnerPoolRetired>(
    'runners.forget-hosts-of-retired-pool',
    ['runner-pool.retired'],
    (event) => reactions.forgetting.servingThrough(event.poolId),
  ),
  subscribing<RunnerTrustWithdrawn>(
    'runners.forget-hosts-of-withdrawn-trust',
    ['runner-trust.withdrawn'],
    (event) => reactions.forgetting.servingThrough(event.trustId),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'runners.withdraw-trusts-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) => reactions.abandoning.trustsOf(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'runners.retire-pools-of-closed-workspace',
    [WORKSPACE_CLOSED],
    async (event) => {
      const workspaceId = WorkspaceId.of(event.workspaceId);

      await reactions.abandoning.poolsOf(workspaceId);
      await reactions.abandoning.egressesOf(workspaceId);
    },
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'runners.drop-runners-declared-by-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) =>
      reactions.abandoning.declarationOf(WorkspaceId.of(event.workspaceId)),
  ),
];
