import {
  RUNNER_REGISTERED,
  type RunnerRegisteredIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-registered.integration-event';
import {
  RUNNER_REVOKED,
  type RunnerRevokedIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-revoked.integration-event';
import {
  TEAM_CREATED,
  type TeamCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-created.integration-event';
import {
  WORKSPACE_CONNECTED,
  type WorkspaceConnectedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-connected.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { BINDABLE_TASK_EVENTS } from '@work/application/contracts/bindable-task-events.contract';
import type { EnqueueChatRun } from '@work/application/events/handlers/enqueue-chat-run.handler';
import type { EnqueueTaskRun } from '@work/application/events/handlers/enqueue-task-run.handler';
import type { NotifyOutsideTools } from '@work/application/events/handlers/notify-outside-tools.handler';
import type {
  NewTeam,
  ProvisionTeam,
} from '@work/application/events/handlers/provision-team.handler';
import type { StopLetGoRun } from '@work/application/events/handlers/stop-let-go-run.handler';
import type { RunnerRevocationPort } from '@work/application/ports/runner-revocation.port';
import type { ProposalAcceptances } from '@work/application/services/proposal-acceptances';
import type { RunOutcomes } from '@work/application/services/run-outcomes';
import type { SettleSetup } from '@work/application/services/settle-setup.service';
import type { ChatHandedToRun } from '@work/domain/events/chat-handed-to-run.event';
import type { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import type { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import type { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { TaskAsked } from '@work/domain/events/task-asked.event';
import type { TaskHandedToRun } from '@work/domain/events/task-handed-to-run.event';
import type { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';

const newTeam = (event: TeamCreatedIntegrationEvent): NewTeam => ({
  workspaceId: WorkspaceId.of(event.workspaceId),
  teamId: TeamId.of(event.teamId),
  owner: UserId.of(event.ownerId),
});

const reactingToOutcomes = (
  name: string,
  outcomes: RunOutcomes,
): readonly DomainEventSubscriber[] => [
  subscribing<RunCompleted>(`${name}.completed`, ['run.completed'], (event) =>
    outcomes.onRunCompleted(event),
  ),
  subscribing<RunAbandoned>(`${name}.abandoned`, ['run.abandoned'], (event) =>
    outcomes.onRunAbandoned(event),
  ),
];

export const workSubscribers = (reactions: {
  handOver: RunOutcomes;
  chatOutcomes: RunOutcomes;
  digests: RunOutcomes;
  provisioning: ProvisionTeam;
  revocation: RunnerRevocationPort;
  acceptances: ProposalAcceptances;
  outsideTools: NotifyOutsideTools;
  taskRuns: EnqueueTaskRun;
  letGoRuns: StopLetGoRun;
  chatRuns: EnqueueChatRun;
  setup: SettleSetup;
}): readonly DomainEventSubscriber[] => [
  ...reactingToOutcomes('work.hand-over', reactions.handOver),
  ...reactingToOutcomes('work.chat-outcomes', reactions.chatOutcomes),
  ...reactingToOutcomes('work.digest-run', reactions.digests),
  subscribing<TeamCreatedIntegrationEvent>(
    'work.open-built-in-lines',
    [TEAM_CREATED],
    (event) => reactions.provisioning.openLines(newTeam(event)),
  ),
  subscribing<TeamCreatedIntegrationEvent>(
    'work.welcome-team',
    [TEAM_CREATED],
    (event) => reactions.provisioning.welcome(newTeam(event)),
  ),
  subscribing<WorkspaceConnectedIntegrationEvent>(
    'work.settle-on-connection',
    [WORKSPACE_CONNECTED],
    (event) => reactions.setup.forWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<RunnerRevokedIntegrationEvent>(
    'work.release-held-runs',
    [RUNNER_REVOKED],
    (event) =>
      reactions.revocation.onRunnerRevoked(RunnerId.of(event.runnerId)),
  ),
  subscribing<ProposalAccepted>(
    'work.create-task-from-proposal',
    ['chat.proposal-accepted'],
    (event) => reactions.acceptances.onProposalAccepted(event),
  ),
  subscribing<TaskOpened>(
    'work.settle-accepted-proposal',
    ['task.opened'],
    (event) => reactions.acceptances.onTaskOpened(event),
  ),
  subscribing<TaskOpened | PullRequestOpened | TaskAsked>(
    'work.notify-outside-tools',
    BINDABLE_TASK_EVENTS,
    (event) => reactions.outsideTools.on(event),
  ),
  subscribing<TaskHandedToRun>(
    'work.enqueue-task-run',
    ['task.handed-to-run'],
    (event) => reactions.taskRuns.on(event),
  ),
  subscribing<TaskLetGoOfRun>(
    'work.stop-let-go-run',
    ['task.let-go-of-run'],
    (event) => reactions.letGoRuns.on(event),
  ),
  subscribing<ChatHandedToRun>(
    'work.enqueue-chat-run',
    ['chat.handed-to-run'],
    (event) => reactions.chatRuns.on(event),
  ),
  subscribing<RunnerRegisteredIntegrationEvent>(
    'work.settle-on-runner',
    [RUNNER_REGISTERED],
    (event) => reactions.setup.forWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
];
