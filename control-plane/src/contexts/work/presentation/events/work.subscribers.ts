import type { RunTokensPort } from '@identity/application/ports/run-tokens.port';
import type {
  RunGrantsPort,
  RunLeaseDto,
} from '@secrets/application/ports/run-grants.port';
import {
  HOST_CONNECTED,
  type HostConnectedIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-connected.integration-event';
import {
  RUNNER_HOST_STARTED_SERVING,
  type RunnerHostStartedServingIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-host-started-serving.integration-event';
import {
  RUNNER_WAY_IN_OPENED,
  type RunnerWayInOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-way-in-opened.integration-event';
import {
  TEAM_CREATED,
  type TeamCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-created.integration-event';
import {
  TEAM_DISBANDED,
  type TeamDisbandedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
import {
  WORKSPACE_CONNECTED,
  type WorkspaceConnectedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-connected.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { BINDABLE_TASK_EVENTS } from '@work/application/contracts/bindable-task-events.contract';
import type { AbandonTeamLines } from '@work/application/events/handlers/abandon-team-lines.handler';
import type { DigestRun } from '@work/application/events/handlers/digest-run.handler';
import type { EnqueueChatRun } from '@work/application/events/handlers/enqueue-chat-run.handler';
import type { EnqueueTaskRun } from '@work/application/events/handlers/enqueue-task-run.handler';
import type { NotifyOutsideTools } from '@work/application/events/handlers/notify-outside-tools.handler';
import {
  type NewTeam,
  PROVISION_TEAM,
  type ProvisionTeam,
} from '@work/application/events/handlers/provision-team.handler';
import type { StopLetGoRun } from '@work/application/events/handlers/stop-let-go-run.handler';
import type { ConnectionsMade } from '@work/application/services/connections-made.service';
import type { Notices } from '@work/application/services/notices.service';
import type { PauseMarks } from '@work/application/services/pause-marks.service';
import type { PausedRuns } from '@work/application/services/paused-runs.service';
import type { ProposalAcceptances } from '@work/application/services/proposal-acceptances';
import type { RunOutcomes } from '@work/application/services/run-outcomes';
import type { RunnerLeases } from '@work/application/services/runner-leases.service';
import type { SettleSetup } from '@work/application/services/settle-setup.service';
import type { ToolUsedHooks } from '@work/application/services/tool-used-hooks.service';
import type { ChatHandedToRun } from '@work/domain/events/chat-handed-to-run.event';
import type { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import type { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import type { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunLapsed } from '@work/domain/events/run-lapsed.event';
import type { RunParked } from '@work/domain/events/run-parked.event';
import type { RunPaused } from '@work/domain/events/run-paused.event';
import type { RunReservationDropped } from '@work/domain/events/run-reservation-dropped.event';
import type { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
import type { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import type { TaskAnswered } from '@work/domain/events/task-answered.event';
import type { TaskAsked } from '@work/domain/events/task-asked.event';
import type { TaskHandedToRun } from '@work/domain/events/task-handed-to-run.event';
import type { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';
import type { ToolUsed } from '@work/domain/events/tool-used.event';

const newTeam = (event: TeamCreatedIntegrationEvent): NewTeam => ({
  workspaceId: WorkspaceId.of(event.workspaceId),
  teamId: TeamId.of(event.teamId),
  owner: UserId.of(event.ownerId),
});

const leaseOf = (event: {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly attempt: number;
}): RunLeaseDto => ({
  workspaceId: event.workspaceId.value,
  runId: event.runId.value,
  attempt: event.attempt,
});

const signedUp = (event: TeamCreatedIntegrationEvent): boolean =>
  event.origin === 'sign-up';

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
  pausedRuns: PausedRuns;
  pauseMarks: PauseMarks;
  chatOutcomes: RunOutcomes;
  digests: DigestRun;
  provisioning: ProvisionTeam;
  acceptances: ProposalAcceptances;
  outsideTools: NotifyOutsideTools;
  taskRuns: EnqueueTaskRun;
  letGoRuns: StopLetGoRun;
  chatRuns: EnqueueChatRun;
  setup: SettleSetup;
  abandoning: AbandonTeamLines;
  runGrants: RunGrantsPort;
  runTokens: RunTokensPort;
  runners: RunnerLeases;
  toolUsedHooks: ToolUsedHooks;
  notices: Notices;
  connections: ConnectionsMade;
}): readonly DomainEventSubscriber[] => [
  subscribing<RunCompleted | RunAbandoned | RunWithdrawn>(
    'work.end-secret-grants-of-ended-run',
    ['run.completed', 'run.abandoned', 'run.withdrawn'],
    (event) => reactions.runGrants.endedFor(leaseOf(event)),
  ),
  subscribing<RunCompleted | RunAbandoned | RunWithdrawn>(
    'work.revoke-tokens-of-ended-run',
    ['run.completed', 'run.abandoned', 'run.withdrawn'],
    (event) =>
      reactions.runTokens.revokeFor(
        event.workspaceId.value,
        event.runId.value,
        null,
      ),
  ),
  subscribing<RunLapsed | RunParked>(
    'work.lose-secret-lease-of-ended-attempt',
    ['run.lapsed', 'run.parked'],
    (event) => reactions.runGrants.leaseLost(leaseOf(event)),
  ),
  subscribing<RunLapsed | RunParked>(
    'work.revoke-tokens-of-ended-attempt',
    ['run.lapsed', 'run.parked'],
    (event) =>
      reactions.runTokens.revokeFor(
        event.workspaceId.value,
        event.runId.value,
        event.attempt,
      ),
  ),
  subscribing<RunCompleted | RunAbandoned | RunWithdrawn>(
    'work.end-runner-of-ended-run',
    ['run.completed', 'run.abandoned', 'run.withdrawn'],
    (event) => reactions.runners.runEnded(event.runId),
  ),
  subscribing<ToolUsed>(
    'work.fire-hooks-after-tool-used',
    ['run.tool-used'],
    (event) => reactions.toolUsedHooks.on(event),
  ),
  subscribing<RunLapsed | RunParked>(
    'work.let-go-of-runner-that-left-its-run',
    ['run.lapsed', 'run.parked'],
    (event) => reactions.runners.runLeft(event.runner, event.at),
  ),
  subscribing<RunPaused>(
    'work.journal-when-a-run-paused',
    ['run.paused'],
    (event) => reactions.pauseMarks.onRunPaused(event),
  ),
  subscribing<TaskAnswered>(
    'work.take-up-the-run-a-person-answered',
    ['task.answered'],
    (event) => reactions.pausedRuns.onTaskAnswered(event),
  ),
  subscribing<HostConnectedIntegrationEvent>(
    'work.answer-asks-to-connect',
    [HOST_CONNECTED],
    async (event) =>
      event.personId !== null &&
      reactions.connections.answer({
        teamId: TeamId.of(event.teamId),
        source: event.source,
        personId: UserId.of(event.personId),
      }),
  ),
  subscribing<RunReservationDropped>(
    'work.let-go-of-reserved-runner',
    ['run.reservation-dropped'],
    (event) => reactions.runners.reservationDropped(event.runner.value),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'work.abandon-lines-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) => reactions.abandoning.of(TeamId.of(event.teamId)),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'work.forget-notices-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) => reactions.notices.forgetTeam(TeamId.of(event.teamId)),
  ),
  ...reactingToOutcomes('work.hand-over', reactions.handOver),
  ...reactingToOutcomes('work.chat-outcomes', reactions.chatOutcomes),
  subscribing<RunCompleted>(
    'work.digest-run.completed',
    ['run.completed'],
    (event) => reactions.digests.onRunCompleted(event),
  ),
  subscribing<RunAbandoned>(
    'work.digest-run.abandoned',
    ['run.abandoned'],
    (event) => reactions.digests.onRunAbandoned(event),
  ),
  subscribing<TeamCreatedIntegrationEvent>(
    PROVISION_TEAM,
    [TEAM_CREATED],
    async (event) =>
      signedUp(event) && reactions.provisioning.provision(newTeam(event)),
  ),
  subscribing<WorkspaceConnectedIntegrationEvent>(
    'work.settle-on-connection',
    [WORKSPACE_CONNECTED],
    (event) => reactions.setup.forWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<SetupPullRequestOpened>(
    'work.settle-on-setup-pull-request',
    ['chat.setup-pull-request-opened'],
    (event) => reactions.setup.forTeam(event.teamId),
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
  subscribing<RunnerWayInOpenedIntegrationEvent>(
    'work.settle-on-way-in',
    [RUNNER_WAY_IN_OPENED],
    (event) => reactions.setup.forWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<RunnerHostStartedServingIntegrationEvent>(
    'work.settle-on-host-serving',
    [RUNNER_HOST_STARTED_SERVING],
    (event) => reactions.setup.forWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
];
