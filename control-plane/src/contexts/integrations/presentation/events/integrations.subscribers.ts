import type { AbandonTeamIntegrations } from '@integrations/application/services/abandon-team-integrations.service';
import type { HookedHappenings } from '@integrations/application/services/hooked-happenings.service';
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
): readonly DomainEventSubscriber[] => [
  subscribing<TeamDisbandedIntegrationEvent>(
    'integrations.abandon-integrations-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      abandoning.of(TeamId.of(event.teamId), WorkspaceId.of(event.workspaceId)),
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
