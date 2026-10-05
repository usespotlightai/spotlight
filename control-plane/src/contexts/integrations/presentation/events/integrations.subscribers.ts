import type { RereadIntegrationSourceHandler } from '@integrations/application/commands/handlers/reread-integration-source.handler';
import { RereadIntegrationSourceCommand } from '@integrations/application/commands/reread-integration-source.command';
import type { AbandonTeamIntegrations } from '@integrations/application/services/abandon-team-integrations.service';
import type { HookedHappenings } from '@integrations/application/services/hooked-happenings.service';
import type { HookAbandonmentDue } from '@integrations/domain/events/hook-abandonment-due.event';
import type { HostConnected } from '@integrations/domain/events/host-connected.event';
import type { IntegrationAbandonmentDue } from '@integrations/domain/events/integration-abandonment-due.event';
import type { IntegrationRedefined } from '@integrations/domain/events/integration-redefined.event';
import type { IntegrationRetired } from '@integrations/domain/events/integration-retired.event';
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
  TEAM_DISBANDED,
  type TeamDisbandedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const integrationsSubscribers = (
  abandoning: AbandonTeamIntegrations,
  hooked: HookedHappenings,
  rereading: RereadIntegrationSourceHandler,
  learned: LearnedOutputRepository,
): readonly DomainEventSubscriber[] => [
  subscribing<TeamDisbandedIntegrationEvent>(
    'integrations.abandon-integrations-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      abandoning.owed(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'integrations.forget-connections-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) => abandoning.connectionsOf(TeamId.of(event.teamId)),
  ),
  subscribing<HookAbandonmentDue>(
    'integrations.abandon-hook-of-disbanded-team',
    ['integrations.hook-abandonment-due'],
    (event) => abandoning.hook(event.id, event.workspaceId),
  ),
  subscribing<IntegrationAbandonmentDue>(
    'integrations.abandon-integration-of-disbanded-team',
    ['integrations.integration-abandonment-due'],
    (event) => abandoning.integration(event.id, event.workspaceId),
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
  subscribing<IntegrationRedefined | IntegrationRetired>(
    'integrations.forget-learned-outputs-of-a-changed-integration',
    ['integrations.integration-redefined', 'integrations.integration-retired'],
    (event) => learned.forgetSource(event.teamId, event.source),
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
