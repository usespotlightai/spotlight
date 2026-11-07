import {
  CHAT_STARTED,
  type ChatStartedIntegrationEvent,
} from '@shared-kernel/application/integration-events/chat-started.integration-event';
import {
  PULL_REQUEST_OPENED,
  type PullRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import {
  PULL_REQUEST_REVIEW_TAKEN,
  type PullRequestReviewTakenIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-review-taken.integration-event';
import {
  REQUESTED_RUN_ENDED,
  type RequestedRunEndedIntegrationEvent,
  type RequestedRunEnding,
} from '@shared-kernel/application/integration-events/requested-run-ended.integration-event';
import {
  RUN_BRIEFED,
  type RunBriefedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-briefed.integration-event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
  type RunEnding,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  RUN_SUPERSEDED,
  type RunSupersededIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-superseded.integration-event';
import {
  RUN_USAGE_RECORDED,
  type RunUsageRecordedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-usage-recorded.integration-event';
import {
  TASK_ACTED_ON,
  type TaskActedOnIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-acted-on.integration-event';
import {
  TASK_ASKED,
  type TaskAskedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-asked.integration-event';
import {
  TASK_DELETED,
  type TaskDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import {
  TASK_DISPATCHED,
  type TaskDispatchedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-dispatched.integration-event';
import {
  TASK_FAILED,
  type TaskFailedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-failed.integration-event';
import {
  TASK_MOVED,
  type TaskMovedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-moved.integration-event';
import {
  TASK_OPENED,
  type TaskOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-opened.integration-event';
import {
  TASK_PASSED,
  type TaskPassedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-passed.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { ChatStarted } from '@work/domain/events/chat-started.event';
import type { DispatchBriefed } from '@work/domain/events/dispatch-briefed.event';
import type { DispatchEnded } from '@work/domain/events/dispatch-ended.event';
import type { DispatchSuperseded } from '@work/domain/events/dispatch-superseded.event';
import type { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import type { PullRequestReviewTaken } from '@work/domain/events/pull-request-review-taken.event';
import type { RunCancelled } from '@work/domain/events/run-cancelled.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunExhausted } from '@work/domain/events/run-exhausted.event';
import type { RunUsageRecorded } from '@work/domain/events/run-usage-recorded.event';
import type { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import type { TaskAsked } from '@work/domain/events/task-asked.event';
import type { TaskDeleted } from '@work/domain/events/task-deleted.event';
import type { TaskDispatched } from '@work/domain/events/task-dispatched.event';
import type { TaskFailed } from '@work/domain/events/task-failed.event';
import type { TaskMoved } from '@work/domain/events/task-moved.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';
import type { TaskPassed } from '@work/domain/events/task-passed.event';
import type { Handover } from '@work/domain/value-objects/handover.vo';

interface Ending {
  readonly ending: RequestedRunEnding;
  readonly outcome: RunEnding;
  readonly failure: string | null;
  readonly stopped: boolean;
  readonly handsOver: boolean;
  readonly handover: Handover | null;
}

const requestedRunEnded = (
  event: RunCompleted | RunExhausted | RunCancelled,
  at: Date,
  ending: Ending,
): RequestedRunEndedIntegrationEvent | null =>
  event.requester.owner.value === WorkRequesters.owner
    ? null
    : {
        kind: REQUESTED_RUN_ENDED,
        runId: event.runId.value,
        workspaceId: event.workspaceId.value,
        requester: event.requester.parts,
        attempt: event.attempt,
        ending: ending.ending,
        outcome: ending.outcome,
        failure: ending.failure,
        stopped: ending.stopped,
        started: event.started,
        askedAPerson: event.asked,
        handsOver: ending.handsOver,
        report: ending.handover
          ? {
              next: ending.handover.next || null,
              note: ending.handover.note || null,
            }
          : null,
        endedAt: at.toISOString(),
      };

export const WORK_EVENT_MAPPERS = [
  mapping<DispatchBriefed>(
    'dispatch.briefed',
    (event): RunBriefedIntegrationEvent => ({
      kind: RUN_BRIEFED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      taskId: event.taskId?.value ?? null,
      memories: event.memories.briefed.map((each) => each.id),
    }),
  ),
  mapping<PullRequestOpened>(
    'task.pull-request-opened',
    (event): PullRequestOpenedIntegrationEvent => ({
      kind: PULL_REQUEST_OPENED,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      url: event.url.value,
      at: event.at.toISOString(),
    }),
  ),
  mapping<PullRequestReviewTaken>(
    'task.pull-request-review-taken',
    (event): PullRequestReviewTakenIntegrationEvent => ({
      kind: PULL_REQUEST_REVIEW_TAKEN,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      url: event.url.value,
    }),
  ),
  mapping<TaskDeleted>(
    'task.deleted',
    (event): TaskDeletedIntegrationEvent => ({
      kind: TASK_DELETED,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
    }),
  ),
  mapping<TaskDispatched>(
    'task.dispatched',
    (event): TaskDispatchedIntegrationEvent => ({
      kind: TASK_DISPATCHED,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      runId: event.runId.value,
    }),
  ),
  mapping<TaskOpened>(
    'task.opened',
    (event): TaskOpenedIntegrationEvent => ({
      kind: TASK_OPENED,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      lineId: event.lineId.value,
      stationId: event.stationId.value,
      by: event.createdBy?.value ?? null,
      at: event.at.toISOString(),
    }),
  ),
  mapping<TaskMoved>(
    'task.moved',
    (event): TaskMovedIntegrationEvent => ({
      kind: TASK_MOVED,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      from: event.from.key.value,
      to: event.to.key.value,
      at: event.at.toISOString(),
    }),
  ),
  mapping<RunCompleted>('run.completed', (event, at) =>
    requestedRunEnded(event, at, {
      ending: 'completed',
      outcome: event.outcome.failed ? 'failed' : 'completed',
      failure: event.outcome.failure?.code ?? null,
      stopped: event.outcome.stopped,
      handsOver: event.outcome.handsOver,
      handover: event.handover,
    }),
  ),
  mapping<RunExhausted>('run.exhausted', (event, at) =>
    requestedRunEnded(event, at, {
      ending: 'exhausted',
      outcome: 'exhausted',
      failure: event.failure,
      stopped: false,
      handsOver: false,
      handover: null,
    }),
  ),
  mapping<RunCancelled>('run.cancelled', (event, at) =>
    requestedRunEnded(event, at, {
      ending: 'cancelled',
      outcome: 'cancelled',
      failure: null,
      stopped: false,
      handsOver: false,
      handover: null,
    }),
  ),
  mapping<DispatchEnded>(
    'dispatch.ended',
    (event): RunEndedIntegrationEvent => ({
      kind: RUN_ENDED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      taskId: event.taskId?.value ?? null,
      stationId: event.stationId?.value ?? null,
      outcome: event.ending.outcome,
      failure: event.ending.failure,
      stopped: event.ending.stopped,
      asked: false,
    }),
  ),
  mapping<DispatchSuperseded>(
    'dispatch.superseded',
    (event): RunSupersededIntegrationEvent => ({
      kind: RUN_SUPERSEDED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      taskId: event.taskId.value,
    }),
  ),
  mapping<TaskActedOn>(
    'task.acted-on',
    (event): TaskActedOnIntegrationEvent => ({
      kind: TASK_ACTED_ON,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      stationId: event.stationId.value,
      action: event.action,
      by: event.by.value,
      afterRunId: event.after?.value ?? null,
      at: event.at.toISOString(),
      tool: event.tool?.tool ?? null,
      server: event.tool?.server ?? null,
    }),
  ),
  mapping<RunUsageRecorded>(
    'run.usage-recorded',
    (event): RunUsageRecordedIntegrationEvent => ({
      kind: RUN_USAGE_RECORDED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      requester: {
        owner: event.requester.owner.value,
        kind: event.requester.kind,
        id: event.requester.id,
        token: event.requester.token,
        team: event.requester.team?.value ?? null,
      },
      listed: event.listed,
      ms: event.ms,
      steps: event.steps,
      errors: event.errors,
      changedLines: event.changedLines,
      contextTokens: event.contextTokens,
      contextWindow: event.contextWindow,
      cost: event.cost?.amount ?? null,
      currency: event.cost?.currency ?? null,
      spentCosts: event.spentCosts.map((each) => ({
        amount: each.amount,
        currency: each.currency,
      })),
      unpricedCalls: event.unpricedCalls,
      inputTokens: event.tokens.input,
      outputTokens: event.tokens.output,
      cacheReadTokens: event.tokens.cacheRead,
      cacheWriteTokens: event.tokens.cacheWrite,
      servers: event.tools.servers.map((each) => ({
        server: each.server,
        calls: each.calls,
        failed: each.failed,
        latency: [...each.latency.counts],
        lastCallFailed: each.lastCallFailed,
      })),
      skillsRead: [...event.tools.skills],
    }),
  ),
  mapping<TaskPassed>(
    'task.passed',
    (event): TaskPassedIntegrationEvent => ({
      kind: TASK_PASSED,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      runId: event.runId.value,
      from: event.from.value,
      to: event.to.value,
      at: event.at.toISOString(),
    }),
  ),
  mapping<TaskFailed>(
    'task.failed',
    (event): TaskFailedIntegrationEvent => ({
      kind: TASK_FAILED,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      stationId: event.stationId.value,
      runId: event.by?.value ?? null,
      source: event.failure.source,
      code: event.failure.code,
      occurrences: event.failure.occurrences,
      at: event.at.toISOString(),
    }),
  ),
  mapping<TaskAsked>(
    'task.asked',
    (event): TaskAskedIntegrationEvent => ({
      kind: TASK_ASKED,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      stationId: event.stationId.value,
      at: event.at.toISOString(),
    }),
  ),
  mapping<ChatStarted>(
    'chat.started',
    (event): ChatStartedIntegrationEvent => ({
      kind: CHAT_STARTED,
      chatId: event.chatId.value,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      by: event.startedBy.value,
      at: event.at.toISOString(),
    }),
  ),
] as const;
