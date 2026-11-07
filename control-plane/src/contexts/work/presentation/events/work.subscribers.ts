import type { RunTokensPort } from '@identity/application/ports/run-tokens.port';
import type {
  RunGrantsPort,
  RunLeaseDto,
} from '@secrets/application/ports/run-grants.port';
import {
  HOST_BECAME_READY,
  type HostBecameReadyIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-became-ready.integration-event';
import {
  RUNNER_ACCESS_CREATED,
  type RunnerAccessCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/runner-access-created.integration-event';
import {
  TEAM_CREATED,
  type TeamCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-created.integration-event';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
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
import type { CancelDetachedRun } from '@work/application/events/handlers/cancel-detached-run.handler';
import type { DeleteTaskDraft } from '@work/application/events/handlers/delete-task-draft.handler';
import type { DeleteTaskInboxRequests } from '@work/application/events/handlers/delete-task-inbox-requests.handler';
import type { DeleteTeamChats } from '@work/application/events/handlers/delete-team-chats.handler';
import type { DispatchRunEndings } from '@work/application/events/handlers/dispatch-run-endings.handler';
import type { DropUnorderedRun } from '@work/application/events/handlers/drop-unordered-run.handler';
import type { EnqueueOrderedRun } from '@work/application/events/handlers/enqueue-ordered-run.handler';
import type { NotifyChannel } from '@work/application/events/handlers/notify-channel.handler';
import type { NotifyOutsideTools } from '@work/application/events/handlers/notify-outside-tools.handler';
import type { OrderChatRun } from '@work/application/events/handlers/order-chat-run.handler';
import type { OrderTaskRun } from '@work/application/events/handlers/order-task-run.handler';
import type { ReleaseTakenMarks } from '@work/application/events/handlers/release-taken-marks.handler';
import type { TakeUpAnsweredRun } from '@work/application/events/handlers/take-up-answered-run.handler';
import {
  type NewTeam,
  WELCOME_TEAM,
  type WelcomeTeam,
} from '@work/application/events/handlers/welcome-team.handler';
import {
  NOTICED_TASK_EVENT_KINDS,
  type NoticedTaskEvent,
} from '@work/application/mappers/bindable-task-event.mapper';
import type { ProposalAcceptances } from '@work/application/ports/proposal-acceptances.port';
import type { Notices } from '@work/application/services/notices.service';
import type { PauseMarks } from '@work/application/services/pause-marks.service';
import type { ReconcileSetup } from '@work/application/services/reconcile-setup.service';
import type { RunOutcomes } from '@work/application/services/run-outcomes';
import type { RunnerLeases } from '@work/application/services/runner-leases.service';
import type { SandboxLeases } from '@work/application/services/sandbox-leases.service';
import type { TakeTurn } from '@work/application/services/take-turn.service';
import type { ToolUsedHooks } from '@work/application/services/tool-used-hooks.service';
import type { ChatDeleted } from '@work/domain/events/chat-deleted.event';
import type { ChatDispatched } from '@work/domain/events/chat-dispatched.event';
import type { ChatRunNotStarted } from '@work/domain/events/chat-run-not-started.event';
import type { ChatStarted } from '@work/domain/events/chat-started.event';
import type { DispatchOrdered } from '@work/domain/events/dispatch-ordered.event';
import type { DispatchRefused } from '@work/domain/events/dispatch-refused.event';
import type { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import type { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import type { RunCancelled } from '@work/domain/events/run-cancelled.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunExhausted } from '@work/domain/events/run-exhausted.event';
import type { RunLeaseExpired } from '@work/domain/events/run-lease-expired.event';
import type { RunPaused } from '@work/domain/events/run-paused.event';
import type { RunReservationDropped } from '@work/domain/events/run-reservation-dropped.event';
import type { RunSuspended } from '@work/domain/events/run-suspended.event';
import type { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import type { TaskAnswered } from '@work/domain/events/task-answered.event';
import type { TaskDeleted } from '@work/domain/events/task-deleted.event';
import type { TaskDispatched } from '@work/domain/events/task-dispatched.event';
import type { TaskMarked } from '@work/domain/events/task-marked.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';
import type { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import type { ToolUsed } from '@work/domain/events/tool-used.event';

const newTeam = (event: TeamCreatedIntegrationEvent): NewTeam => ({
  teamId: TeamId.of(event.teamId),
  owner: UserId.of(event.ownerId),
  origin: event.origin,
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

const reactingToOutcomes = (
  name: string,
  outcomes: RunOutcomes,
  { callsOut } = { callsOut: false },
): readonly DomainEventSubscriber[] => [
  subscribing<RunCompleted>(
    `${name}.completed`,
    ['run.completed'],
    (event) => outcomes.onRunCompleted(event),
    { callsOut },
  ),
  subscribing<RunExhausted>(
    `${name}.exhausted`,
    ['run.exhausted'],
    (event) => outcomes.onRunExhausted(event),
    { callsOut },
  ),
];

export const workSubscribers = (reactions: {
  handOver: RunOutcomes;
  answeredRuns: TakeUpAnsweredRun;
  turns: TakeTurn;
  pauseMarks: PauseMarks;
  chatOutcomes: RunOutcomes;
  channel: NotifyChannel;
  welcoming: WelcomeTeam;
  acceptances: ProposalAcceptances;
  outsideTools: NotifyOutsideTools;
  taskRuns: OrderTaskRun;
  detachedRuns: CancelDetachedRun;
  chatRuns: OrderChatRun;
  orderedRuns: EnqueueOrderedRun;
  unorderedRuns: DropUnorderedRun;
  dispatchEndings: DispatchRunEndings;
  setup: ReconcileSetup;
  deletingChats: DeleteTeamChats;
  taskInboxRequests: DeleteTaskInboxRequests;
  taskDraft: DeleteTaskDraft;
  runGrants: RunGrantsPort;
  runTokens: RunTokensPort;
  runners: RunnerLeases;
  sandboxes: SandboxLeases;
  toolUsedHooks: ToolUsedHooks;
  notices: Notices;
  takenMarks: ReleaseTakenMarks;
}): readonly DomainEventSubscriber[] => [
  subscribing<RunCompleted | RunExhausted | RunCancelled>(
    'work.end-secret-grants-of-ended-run',
    ['run.completed', 'run.exhausted', 'run.cancelled'],
    (event) => reactions.runGrants.endedFor(leaseOf(event)),
  ),
  subscribing<RunCompleted | RunExhausted | RunCancelled>(
    'work.revoke-tokens-of-ended-run',
    ['run.completed', 'run.exhausted', 'run.cancelled'],
    (event) =>
      reactions.runTokens.revokeFor(
        event.workspaceId.value,
        event.runId.value,
        null,
      ),
    { callsOut: true },
  ),
  subscribing<RunLeaseExpired | RunSuspended>(
    'work.lose-secret-lease-of-ended-attempt',
    ['run.lease-expired', 'run.suspended'],
    (event) => reactions.runGrants.leaseLost(leaseOf(event)),
  ),
  subscribing<RunLeaseExpired | RunSuspended>(
    'work.revoke-tokens-of-ended-attempt',
    ['run.lease-expired', 'run.suspended'],
    (event) =>
      reactions.runTokens.revokeFor(
        event.workspaceId.value,
        event.runId.value,
        event.attempt,
      ),
    { callsOut: true },
  ),
  subscribing<RunCompleted | RunExhausted | RunCancelled>(
    'work.end-runner-of-ended-run',
    ['run.completed', 'run.exhausted', 'run.cancelled'],
    (event) => reactions.runners.runEnded(event.runId),
  ),
  subscribing<RunCompleted | RunExhausted | RunCancelled>(
    'work.release-sandbox-of-ended-run',
    ['run.completed', 'run.exhausted', 'run.cancelled'],
    (event) => reactions.sandboxes.runEnded(event.runId),
  ),
  subscribing<RunLeaseExpired | RunSuspended>(
    'work.release-sandbox-of-left-run',
    ['run.lease-expired', 'run.suspended'],
    (event) => reactions.sandboxes.runLeft(event.runId),
  ),
  subscribing<ToolUsed>(
    'work.fire-hooks-after-tool-used',
    ['tool.used'],
    (event) => reactions.toolUsedHooks.on(event),
  ),
  subscribing<RunLeaseExpired | RunSuspended>(
    'work.release-runner-that-left-its-run',
    ['run.lease-expired', 'run.suspended'],
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
    (event) => reactions.answeredRuns.on(event),
    { callsOut: true },
  ),
  subscribing<RunSuspended>(
    'work.take-turn',
    ['run.suspended'],
    (event) => reactions.turns.take(event.runId, event.attempt),
    { callsOut: true },
  ),
  subscribing<RunReservationDropped>(
    'work.release-reserved-runner',
    ['run.reservation-dropped'],
    (event) => reactions.runners.reservationDropped(event.runner.value),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'work.delete-chats-of-deleted-team',
    [TEAM_DELETED],
    (event) => reactions.deletingChats.deleteForTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'work.delete-notices-of-deleted-team',
    [TEAM_DELETED],
    (event) => reactions.notices.deleteForTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'work.forget-welcome-of-deleted-team',
    [TEAM_DELETED],
    (event) => reactions.welcoming.forget(TeamId.of(event.teamId)),
  ),
  ...reactingToOutcomes('work.hand-over', reactions.handOver),
  ...reactingToOutcomes('work.chat-outcomes', reactions.chatOutcomes),
  ...reactingToOutcomes('work.notify-channel', reactions.channel, {
    callsOut: true,
  }),
  subscribing<ChatStarted>(
    'work.notify-channel.started',
    ['chat.started'],
    (event) => reactions.channel.onChatStarted(event),
    { callsOut: true },
  ),
  subscribing<ChatDispatched>(
    'work.notify-channel.dispatched',
    ['chat.dispatched'],
    (event) => reactions.channel.onChatDispatched(event),
    { callsOut: true },
  ),
  subscribing<ChatRunNotStarted>(
    'work.notify-channel.run-not-started',
    ['chat.run-not-started'],
    (event) => reactions.channel.onRunNotStarted(event),
    { callsOut: true },
  ),
  subscribing<TaskOpened>(
    'work.notify-channel.task-opened',
    ['task.opened'],
    (event) => reactions.channel.onTaskOpened(event),
    { callsOut: true },
  ),
  subscribing<ProposalDismissed>(
    'work.notify-channel.proposal-dismissed',
    ['chat.proposal-dismissed'],
    (event) => reactions.channel.onProposalDismissed(event),
    { callsOut: true },
  ),
  subscribing<TeamCreatedIntegrationEvent>(
    WELCOME_TEAM,
    [TEAM_CREATED],
    (event) => reactions.welcoming.welcome(newTeam(event)),
  ),
  subscribing<WorkspaceConnectedIntegrationEvent>(
    'work.reconcile-setup-on-connection',
    [WORKSPACE_CONNECTED],
    (event) => reactions.setup.forWorkspace(WorkspaceId.of(event.workspaceId)),
    { callsOut: true },
  ),
  subscribing<SetupPullRequestOpened>(
    'work.reconcile-setup-on-pull-request',
    ['chat.setup-pull-request-opened'],
    (event) => reactions.setup.forTeam(event.teamId),
    { callsOut: true },
  ),
  subscribing<ProposalAccepted>(
    'work.create-task-from-proposal',
    ['chat.proposal-accepted'],
    (event) => reactions.acceptances.onProposalAccepted(event),
    { callsOut: true },
  ),
  subscribing<TaskOpened>(
    'work.complete-accepted-proposal',
    ['task.opened'],
    (event) => reactions.acceptances.onTaskOpened(event),
  ),
  subscribing<NoticedTaskEvent>(
    'work.notify-outside-tools',
    NOTICED_TASK_EVENT_KINDS,
    (event) => reactions.outsideTools.on(event),
    { callsOut: true },
  ),
  subscribing<TaskDispatched>(
    'work.order-task-run',
    ['task.dispatched'],
    (event) => reactions.taskRuns.on(event),
  ),
  subscribing<DispatchOrdered>(
    'work.enqueue-ordered-run',
    ['dispatch.ordered'],
    (event) => reactions.orderedRuns.on(event),
    { callsOut: true },
  ),
  subscribing<DispatchRefused>(
    'work.drop-unordered-task-run',
    ['dispatch.refused'],
    (event) => reactions.unorderedRuns.ofTask(event),
  ),
  subscribing<DispatchRefused>(
    'work.drop-unordered-chat-run',
    ['dispatch.refused'],
    (event) => reactions.unorderedRuns.ofChat(event),
  ),
  subscribing<RunCompleted>(
    'work.end-dispatch.completed',
    ['run.completed'],
    (event) => reactions.dispatchEndings.onRunCompleted(event),
  ),
  subscribing<RunExhausted>(
    'work.end-dispatch.exhausted',
    ['run.exhausted'],
    (event) => reactions.dispatchEndings.onRunExhausted(event),
  ),
  subscribing<RunCancelled>(
    'work.end-dispatch.cancelled',
    ['run.cancelled'],
    (event) => reactions.dispatchEndings.onRunCancelled(event),
  ),
  subscribing<TaskRunDetached>(
    'work.detach-dispatch',
    ['task.run-detached'],
    (event) => reactions.dispatchEndings.onTaskRunDetached(event),
  ),
  subscribing<ChatDeleted>(
    'work.detach-dispatch-of-deleted-chat',
    ['chat.deleted'],
    (event) => reactions.dispatchEndings.onChatDeleted(event),
  ),
  subscribing<TaskRunDetached>(
    'work.cancel-detached-run',
    ['task.run-detached'],
    (event) => reactions.detachedRuns.on(event),
  ),
  subscribing<TaskMarked>(
    'work.release-marks-taken-by-another-task',
    ['task.marked'],
    (event) => reactions.takenMarks.on(event),
    { callsOut: true },
  ),
  subscribing<TaskDeleted>(
    'work.delete-inbox-requests-of-deleted-task',
    ['task.deleted'],
    (event) => reactions.taskInboxRequests.on(event),
    { callsOut: true },
  ),
  subscribing<TaskDeleted>(
    'work.delete-draft-of-deleted-task',
    ['task.deleted'],
    (event) => reactions.taskDraft.on(event),
  ),
  subscribing<ChatDeleted>(
    'work.cancel-run-of-deleted-chat',
    ['chat.deleted'],
    (event) => reactions.detachedRuns.onChatDeleted(event),
  ),
  subscribing<ChatDispatched>(
    'work.order-chat-run',
    ['chat.dispatched'],
    (event) => reactions.chatRuns.on(event),
  ),
  subscribing<RunnerAccessCreatedIntegrationEvent>(
    'work.reconcile-setup-on-runner-access',
    [RUNNER_ACCESS_CREATED],
    (event) => reactions.setup.forWorkspace(WorkspaceId.of(event.workspaceId)),
    { callsOut: true },
  ),
  subscribing<HostBecameReadyIntegrationEvent>(
    'work.reconcile-setup-on-host-ready',
    [HOST_BECAME_READY],
    (event) => reactions.setup.forWorkspace(WorkspaceId.of(event.workspaceId)),
    { callsOut: true },
  ),
];
