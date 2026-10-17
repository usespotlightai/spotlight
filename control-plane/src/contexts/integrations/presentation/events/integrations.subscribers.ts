import type { RereadIntegrationSourceHandler } from '@integrations/application/commands/handlers/reread-integration-source.handler';
import { RereadIntegrationSourceCommand } from '@integrations/application/commands/reread-integration-source.command';
import type { DeleteTeamIntegrations } from '@integrations/application/services/delete-team-integrations.service';
import type { HookedHappenings } from '@integrations/application/services/hooked-happenings.service';
import type { HookDeletionRequested } from '@integrations/domain/events/hook-deletion-requested.event';
import type { HostConnected } from '@integrations/domain/events/host-connected.event';
import type { IntegrationDeleted } from '@integrations/domain/events/integration-deleted.event';
import type { IntegrationDeletionRequested } from '@integrations/domain/events/integration-deletion-requested.event';
import type { IntegrationUpdated } from '@integrations/domain/events/integration-updated.event';
import type { LearnedOutputRepository } from '@integrations/domain/repositories/learned-output.repository';
import {
  PULL_REQUEST_CLOSED,
  type PullRequestClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  TASK_MOVED,
  type TaskMovedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-moved.integration-event';
import {
  TASK_OPENED,
  type TaskOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-opened.integration-event';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const integrationsSubscribers = (
  deleting: DeleteTeamIntegrations,
  hooked: HookedHappenings,
  rereading: RereadIntegrationSourceHandler,
  learned: LearnedOutputRepository,
): readonly DomainEventSubscriber[] => [
  subscribing<TeamDeletedIntegrationEvent>(
    'integrations.delete-integrations-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      deleting.pendingDeletions(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'integrations.delete-connections-of-deleted-team',
    [TEAM_DELETED],
    (event) => deleting.deleteConnectionsForTeam(TeamId.of(event.teamId)),
  ),
  subscribing<HookDeletionRequested>(
    'integrations.delete-hook-of-deleted-team',
    ['integrations.hook-deletion-requested'],
    (event) => deleting.deleteHook(event.id, event.workspaceId),
  ),
  subscribing<IntegrationDeletionRequested>(
    'integrations.delete-integration-of-deleted-team',
    ['integrations.integration-deletion-requested'],
    (event) => deleting.deleteIntegration(event.id, event.workspaceId),
  ),
  subscribing<HostConnected>(
    'integrations.reread-source-when-a-host-connected',
    ['integrations.host-connected'],
    async (event) =>
      event.changesWhatDescriptionsAreReadWith &&
      rereading.execute(
        new RereadIntegrationSourceCommand(
          event.teamId.value,
          event.source.value,
        ),
      ),
  ),
  subscribing<IntegrationUpdated | IntegrationDeleted>(
    'integrations.delete-learned-outputs-of-a-changed-integration',
    ['integrations.integration-updated', 'integrations.integration-deleted'],
    (event) => learned.deleteForSource(event.teamId, event.source),
  ),
  subscribing<RunEndedIntegrationEvent>(
    'integrations.fire-hooks-when-a-run-ended',
    [RUN_ENDED],
    (event) => hooked.runEnded(event),
  ),
  subscribing<TaskOpenedIntegrationEvent>(
    'integrations.fire-hooks-when-a-task-opened',
    [TASK_OPENED],
    (event) => hooked.taskOpened(event),
  ),
  subscribing<TaskMovedIntegrationEvent>(
    'integrations.fire-hooks-when-a-task-moved',
    [TASK_MOVED],
    (event) => hooked.taskMoved(event),
  ),
  subscribing<PullRequestClosedIntegrationEvent>(
    'integrations.fire-hooks-when-a-pull-request-merged',
    [PULL_REQUEST_CLOSED],
    (event) => hooked.pullRequestClosed(event),
  ),
];
