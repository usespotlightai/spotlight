import {
  CHAT_STARTED,
  type ChatStartedIntegrationEvent,
} from '@shared-kernel/application/integration-events/chat-started.integration-event';
import {
  LINE_REDEFINED,
  type LineRedefinedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-redefined.integration-event';
import {
  PULL_REQUEST_OPENED,
  type PullRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import {
  PULL_REQUEST_REVIEW_TAKEN,
  type PullRequestReviewTakenIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-review-taken.integration-event';
import {
  REPLAY_DIGESTED,
  type ReplayDigestedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-digested.integration-event';
import {
  REPLAY_ENDED,
  type ReplayEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-ended.integration-event';
import {
  RUN_BRIEFED,
  type RunBriefedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-briefed.integration-event';
import {
  RUN_DIGESTED,
  type RunDigestedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-digested.integration-event';
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
  SEARCH_RUN_DIGESTED,
  type SearchRunDigestedIntegrationEvent,
} from '@shared-kernel/application/integration-events/search-run-digested.integration-event';
import {
  SEARCH_RUN_ENDED,
  type SearchRunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/search-run-ended.integration-event';
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
  TASK_FAILED,
  type TaskFailedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-failed.integration-event';
import {
  TASK_HANDED_ON,
  type TaskHandedOnIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-handed-on.integration-event';
import {
  TASK_HANDED_TO_RUN,
  type TaskHandedToRunIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-handed-to-run.integration-event';
import {
  TASK_MOVED,
  type TaskMovedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-moved.integration-event';
import {
  TASK_OPENED,
  type TaskOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-opened.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';
import type { ChatStarted } from '@work/domain/events/chat-started.event';
import type { LineRedefined } from '@work/domain/events/line-redefined.event';
import type { LineRetired } from '@work/domain/events/line-retired.event';
import type { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import type { PullRequestReviewTaken } from '@work/domain/events/pull-request-review-taken.event';
import type { ReplayDigested } from '@work/domain/events/replay-digested.event';
import type { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import type { RunBriefed } from '@work/domain/events/run-briefed.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunDigested } from '@work/domain/events/run-digested.event';
import type { RunSuperseded } from '@work/domain/events/run-superseded.event';
import type { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
import type { SearchDigested } from '@work/domain/events/search-digested.event';
import type { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import type { TaskAsked } from '@work/domain/events/task-asked.event';
import type { TaskDeleted } from '@work/domain/events/task-deleted.event';
import type { TaskFailed } from '@work/domain/events/task-failed.event';
import type { TaskHandedOn } from '@work/domain/events/task-handed-on.event';
import type { TaskHandedToRun } from '@work/domain/events/task-handed-to-run.event';
import type { TaskMoved } from '@work/domain/events/task-moved.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';
import type { Declaration } from '@work/domain/value-objects/declaration.vo';

interface Ending {
  readonly failure: string | null;
  readonly stopped: boolean;
  readonly asked: boolean;
  readonly declared: Declaration | null;
}

const UNSAID: Ending = {
  failure: null,
  stopped: false,
  asked: false,
  declared: null,
};

type Ended =
  | RunEndedIntegrationEvent
  | ReplayEndedIntegrationEvent
  | SearchRunEndedIntegrationEvent;

const ended = (
  event: RunCompleted | RunAbandoned | RunWithdrawn,
  at: Date,
  outcome: RunEnding,
  ending: Ending = UNSAID,
): Ended => {
  const runEnded = (): RunEndedIntegrationEvent => ({
    kind: RUN_ENDED,
    runId: event.runId.value,
    workspaceId: event.workspaceId.value,
    taskId: event.taskId?.value ?? null,
    stationId: event.subject?.stationId?.value ?? null,
    outcome,
    failure: ending.failure,
    stopped: ending.stopped,
    asked: ending.asked,
  });

  if (!event.subject) {
    return runEnded();
  }

  return event.subject.match<Ended>({
    task: runEnded,
    chat: runEnded,
    replay: (original) => ({
      kind: REPLAY_ENDED,
      runId: event.runId.value,
      replayOf: original.value,
      workspaceId: event.workspaceId.value,
      outcome,
      failure: ending.failure,
      stopped: ending.stopped,
      asked: ending.asked,
      next: ending.declared?.next || null,
      note: ending.declared?.note || null,
    }),
    search: (searchId, iteration, stationId, teamId) => ({
      kind: SEARCH_RUN_ENDED,
      runId: event.runId.value,
      searchId: searchId.value,
      iteration: iteration.value,
      workspaceId: event.workspaceId.value,
      teamId: teamId.value,
      stationId: stationId?.value ?? null,
      outcome,
      failure: ending.failure,
      asked: ending.asked,
      stopped: ending.stopped,
      started: outcome !== 'withdrawn' || event.attempt > 1,
      endedAt: at.toISOString(),
    }),
  });
};

const redefined = (
  event: LineRedefined | LineRetired,
): LineRedefinedIntegrationEvent => ({
  kind: LINE_REDEFINED,
  lineId: event.lineId.value,
  workspaceId: event.workspaceId.value,
  teamId: event.teamId.value,
  stationIds: event.stationIds.map((each) => each.value),
});

export const WORK_PUBLICATIONS = [
  publishing<RunBriefed>(
    'run.briefed',
    (event): RunBriefedIntegrationEvent => ({
      kind: RUN_BRIEFED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      memories: event.memories.briefed.map((each) => each.id),
    }),
  ),
  publishing<PullRequestOpened>(
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
  publishing<PullRequestReviewTaken>(
    'task.pull-request-review-taken',
    (event): PullRequestReviewTakenIntegrationEvent => ({
      kind: PULL_REQUEST_REVIEW_TAKEN,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      url: event.url.value,
    }),
  ),
  publishing<TaskDeleted>(
    'task.deleted',
    (event): TaskDeletedIntegrationEvent => ({
      kind: TASK_DELETED,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
    }),
  ),
  publishing<TaskHandedToRun>(
    'task.handed-to-run',
    (event): TaskHandedToRunIntegrationEvent => ({
      kind: TASK_HANDED_TO_RUN,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      runId: event.runId.value,
    }),
  ),
  publishing<TaskOpened>(
    'task.opened',
    (event): TaskOpenedIntegrationEvent => ({
      kind: TASK_OPENED,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      lineId: event.lineId.value,
      stationId: event.stationId.value,
      by: event.raisedBy?.value ?? null,
      at: event.at.toISOString(),
    }),
  ),
  publishing<TaskMoved>(
    'task.moved',
    (event): TaskMovedIntegrationEvent => ({
      kind: TASK_MOVED,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      from: event.from.value,
      to: event.to.value,
      at: event.at.toISOString(),
    }),
  ),
  publishing<RunCompleted>('run.completed', (event, at) =>
    ended(event, at, event.outcome.failed ? 'failed' : 'completed', {
      failure: event.outcome.failure?.code ?? null,
      stopped: event.outcome.stopped,
      asked: event.asked === true,
      declared: event.declared,
    }),
  ),
  publishing<RunAbandoned>('run.abandoned', (event, at) =>
    ended(event, at, 'abandoned', {
      ...UNSAID,
      failure: event.failure,
      asked: event.asked === true,
    }),
  ),
  publishing<RunWithdrawn>('run.withdrawn', (event, at) =>
    ended(event, at, 'withdrawn', { ...UNSAID, asked: event.asked === true }),
  ),
  publishing<RunSuperseded>(
    'run.superseded',
    (event): RunSupersededIntegrationEvent => ({
      kind: RUN_SUPERSEDED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      taskId: event.taskId?.value ?? null,
    }),
  ),
  publishing<TaskActedOn>(
    'task.acted-on',
    (event): TaskActedOnIntegrationEvent => ({
      kind: TASK_ACTED_ON,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      stationId: event.stationId.value,
      act: event.act,
      by: event.by.value,
      after: event.after?.value ?? null,
      at: event.at.toISOString(),
      tool: event.tool?.tool ?? null,
      server: event.tool?.server ?? null,
      forApproval: event.forApproval,
    }),
  ),
  publishing<RunDigested>(
    'run.digested',
    (event): RunDigestedIntegrationEvent => ({
      kind: RUN_DIGESTED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      taskId: event.taskId?.value ?? null,
      ms: event.ms,
      steps: event.steps,
      faults: event.faults,
      changedLines: event.changedLines,
      used: event.used,
      size: event.size,
      cost: event.cost?.amount ?? null,
      currency: event.cost?.currency ?? null,
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
  publishing<ReplayDigested>(
    'replay.digested',
    (event): ReplayDigestedIntegrationEvent => ({
      kind: REPLAY_DIGESTED,
      runId: event.runId.value,
      replayOf: event.replayOf.value,
      workspaceId: event.workspaceId.value,
      ms: event.ms,
      steps: event.steps,
      changedLines: event.changedLines,
      cost: event.cost?.amount ?? null,
      currency: event.cost?.currency ?? null,
      inputTokens: event.tokens.input,
      outputTokens: event.tokens.output,
      cacheReadTokens: event.tokens.cacheRead,
      cacheWriteTokens: event.tokens.cacheWrite,
    }),
  ),
  publishing<SearchDigested>(
    'search.digested',
    (event): SearchRunDigestedIntegrationEvent => ({
      kind: SEARCH_RUN_DIGESTED,
      runId: event.runId.value,
      searchId: event.searchId.value,
      workspaceId: event.workspaceId.value,
      ms: event.ms,
      steps: event.steps,
      spentCosts: event.spentCosts.map((each) => ({
        amount: each.amount,
        currency: each.currency,
      })),
      unpricedCalls: event.unpricedCalls,
      inputTokens: event.tokens.input,
      outputTokens: event.tokens.output,
      cacheReadTokens: event.tokens.cacheRead,
      cacheWriteTokens: event.tokens.cacheWrite,
    }),
  ),
  publishing<TaskHandedOn>(
    'task.handed-on',
    (event): TaskHandedOnIntegrationEvent => ({
      kind: TASK_HANDED_ON,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      runId: event.runId.value,
      from: event.from.value,
      to: event.to.value,
      at: event.at.toISOString(),
    }),
  ),
  publishing<TaskFailed>(
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
  publishing<TaskAsked>(
    'task.asked',
    (event): TaskAskedIntegrationEvent => ({
      kind: TASK_ASKED,
      taskId: event.taskId.value,
      workspaceId: event.workspaceId.value,
      stationId: event.stationId.value,
      at: event.at.toISOString(),
    }),
  ),
  publishing<ChatStarted>(
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
  publishing<LineRedefined>('line.redefined', redefined),
  publishing<LineRetired>('line.retired', redefined),
] as const;
