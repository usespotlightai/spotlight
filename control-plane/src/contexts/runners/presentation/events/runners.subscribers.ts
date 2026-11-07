import type { SandboxUpkeepPort } from '@runners/application/ports/sandbox-upkeep.port';
import type { DeleteRunnersOfDeletedWorkspace } from '@runners/application/services/delete-runners-of-deleted-workspace.service';
import type { PurgeStaleHosts } from '@runners/application/services/purge-stale-hosts.service';
import type { HostStoppedReportingSandbox } from '@runners/domain/events/host-stopped-reporting-sandbox.event';
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
  sandboxes: SandboxUpkeepPort;
}): readonly DomainEventSubscriber[] => [
  subscribing<HostStoppedReportingSandbox>(
    'runners.lose-sandbox-its-host-stopped-reporting',
    ['runner-host.stopped-reporting-sandbox'],
    (event) =>
      reactions.sandboxes.droppedBy(event.hostId, event.sandboxId, event.at),
  ),
  subscribing<RunnerPoolDeleted>(
    'runners.delete-hosts-of-deleted-pool',
    ['runner-pool.deleted'],
    (event) => reactions.hosts.deleteHostsOf(event.poolId),
    { callsOut: true },
  ),
  subscribing<RunnerTrustDeleted>(
    'runners.delete-hosts-of-deleted-trust',
    ['runner-trust.deleted'],
    (event) => reactions.hosts.deleteHostsOf(event.trustId),
    { callsOut: true },
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'runners.delete-trusts-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) => reactions.deleting.trustsOf(WorkspaceId.of(event.workspaceId)),
    { callsOut: true },
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'runners.delete-pools-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) => reactions.deleting.poolsOf(WorkspaceId.of(event.workspaceId)),
    { callsOut: true },
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'runners.delete-egresses-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) => reactions.deleting.egressesOf(WorkspaceId.of(event.workspaceId)),
    { callsOut: true },
  ),
  subscribing<RunnerPoolDeleted>(
    'runners.delete-egresses-after-last-pool-of-deleted-workspace',
    ['runner-pool.deleted'],
    (event) => reactions.deleting.egressesAfterPoolOf(event.workspaceId),
    { callsOut: true },
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'runners.delete-runners-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.workspaceRunnersOf(WorkspaceId.of(event.workspaceId)),
  ),
];
