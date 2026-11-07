import type { RefreshIntegrationSpecHandler } from '@integrations/application/commands/handlers/refresh-integration-spec.handler';
import { RefreshIntegrationSpecCommand } from '@integrations/application/commands/refresh-integration-spec.command';
import type { DeleteTeamIntegrations } from '@integrations/application/services/delete-team-integrations.service';
import type { InboundDeliveryRetention } from '@integrations/application/services/inbound-delivery-retention.service';
import type { InferOutputSchemas } from '@integrations/application/services/infer-output-schemas.service';
import type { IntegrationCursors } from '@integrations/application/services/integration-cursors.service';
import type { LifecycleHookTriggers } from '@integrations/application/services/lifecycle-hook-triggers.service';
import type { IntegrationConnected } from '@integrations/domain/events/integration-connected.event';
import type { IntegrationDeleted } from '@integrations/domain/events/integration-deleted.event';
import type { IntegrationUpdated } from '@integrations/domain/events/integration-updated.event';
import {
  DISPATCH_ENDED,
  type DispatchEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/dispatch-ended.integration-event';
import {
  PULL_REQUEST_CLOSED,
  type PullRequestClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
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
import type { ConnectionAsksPort } from '@work/application/ports/connection-asks.port';

export const integrationsSubscribers = (
  deleting: DeleteTeamIntegrations,
  hookTriggers: LifecycleHookTriggers,
  refreshingSpec: RefreshIntegrationSpecHandler,
  inferring: InferOutputSchemas,
  connectionAsks: ConnectionAsksPort,
  cursors: IntegrationCursors,
  deliveries: InboundDeliveryRetention,
): readonly DomainEventSubscriber[] => [
  subscribing<TeamDeletedIntegrationEvent>(
    'integrations.delete-integrations-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      deleting.deleteIntegrations(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'integrations.delete-hooks-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      deleting.deleteHooks(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'integrations.disconnect-connections-of-deleted-team',
    [TEAM_DELETED],
    (event) => deleting.disconnectConnections(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'integrations.remove-client-registrations-of-deleted-team',
    [TEAM_DELETED],
    (event) => deleting.removeClientRegistrations(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'integrations.remove-inferred-output-schemas-of-deleted-team',
    [TEAM_DELETED],
    (event) => deleting.removeInferredOutputSchemas(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'integrations.remove-person-tool-policies-of-deleted-team',
    [TEAM_DELETED],
    (event) => deleting.removePersonToolPolicies(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'integrations.remove-poll-cursors-of-deleted-team',
    [TEAM_DELETED],
    (event) => cursors.removePollCursorsOfTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'integrations.remove-schedule-cursors-of-deleted-team',
    [TEAM_DELETED],
    (event) => cursors.removeScheduleCursorsOfTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'integrations.remove-inbound-deliveries-of-deleted-team',
    [TEAM_DELETED],
    (event) => deliveries.removeAddressedTo(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<IntegrationDeleted>(
    'integrations.remove-poll-cursor-of-a-deleted-integration',
    ['integration.deleted'],
    (event) => cursors.removePollCursorOf(event.teamId, event.integration),
    { callsOut: true },
  ),
  subscribing<IntegrationDeleted>(
    'integrations.remove-schedule-cursor-of-a-deleted-integration',
    ['integration.deleted'],
    (event) => cursors.removeScheduleCursorOf(event.teamId, event.integration),
    { callsOut: true },
  ),
  subscribing<IntegrationConnected>(
    'integrations.refresh-spec-when-an-integration-connected',
    ['integration.connected'],
    async (event) =>
      event.changesSpecFetch &&
      refreshingSpec.execute(
        new RefreshIntegrationSpecCommand(
          event.teamId.value,
          event.integration.value,
        ),
      ),
    { callsOut: true },
  ),
  subscribing<IntegrationConnected>(
    'integrations.answer-asks-to-connect',
    ['integration.connected'],
    async (event) => {
      const person = event.answersAsksOf;

      return (
        person !== null &&
        connectionAsks.answer({
          teamId: event.teamId,
          integration: event.integration.value,
          personId: person,
        })
      );
    },
    { callsOut: true },
  ),
  subscribing<IntegrationUpdated | IntegrationDeleted>(
    'integrations.delete-inferred-output-schemas-of-a-changed-integration',
    ['integration.updated', 'integration.deleted'],
    (event) => inferring.forget(event.teamId, event.integration),
    { callsOut: true },
  ),
  subscribing<DispatchEndedIntegrationEvent>(
    'integrations.fire-hooks-when-a-run-ended',
    [DISPATCH_ENDED],
    (event) => hookTriggers.runEnded(event),
    { callsOut: true },
  ),
  subscribing<TaskOpenedIntegrationEvent>(
    'integrations.fire-hooks-when-a-task-opened',
    [TASK_OPENED],
    (event) => hookTriggers.taskOpened(event),
    { callsOut: true },
  ),
  subscribing<TaskMovedIntegrationEvent>(
    'integrations.fire-hooks-when-a-task-moved',
    [TASK_MOVED],
    (event) => hookTriggers.taskMoved(event),
    { callsOut: true },
  ),
  subscribing<PullRequestClosedIntegrationEvent>(
    'integrations.fire-hooks-when-a-pull-request-merged',
    [PULL_REQUEST_CLOSED],
    (event) => hookTriggers.pullRequestClosed(event),
    { callsOut: true },
  ),
];
