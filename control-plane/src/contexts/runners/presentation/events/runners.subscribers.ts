import type { DeleteRunnersOfDeletedWorkspace } from '@runners/application/services/delete-runners-of-deleted-workspace.service';
import type { PurgeStaleHosts } from '@runners/application/services/purge-stale-hosts.service';
import type { RunnerPoolDeleted } from '@runners/domain/events/runner-pool-deleted.event';
import type { RunnerTrustDeleted } from '@runners/domain/events/runner-trust-deleted.event';
import {
  WORKSPACE_DELETED,
  type WorkspaceDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const runnersSubscribers = (reactions: {
  deleting: DeleteRunnersOfDeletedWorkspace;
  hosts: PurgeStaleHosts;
}): readonly DomainEventSubscriber[] => [
  subscribing<RunnerPoolDeleted>(
    'runners.delete-hosts-of-deleted-pool',
    ['runner-pool.deleted'],
    (event) => reactions.hosts.servingThrough(event.poolId),
  ),
  subscribing<RunnerTrustDeleted>(
    'runners.delete-hosts-of-deleted-trust',
    ['runner-trust.deleted'],
    (event) => reactions.hosts.servingThrough(event.trustId),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'runners.delete-trusts-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) => reactions.deleting.trustsOf(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'runners.delete-pools-of-deleted-workspace',
    [WORKSPACE_DELETED],
    async (event) => {
      const workspaceId = WorkspaceId.of(event.workspaceId);

      await reactions.deleting.poolsOf(workspaceId);
      await reactions.deleting.egressesOf(workspaceId);
    },
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'runners.delete-runners-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.declarationOf(WorkspaceId.of(event.workspaceId)),
  ),
];
