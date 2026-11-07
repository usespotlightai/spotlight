import {
  CHAT_STARTED,
  type ChatStartedIntegrationEvent,
} from '@shared-kernel/application/integration-events/chat-started.integration-event';
import {
  DISPATCH_BRIEFED,
  type DispatchBriefedIntegrationEvent,
} from '@shared-kernel/application/integration-events/dispatch-briefed.integration-event';
import {
  DISPATCH_ENDED,
  type DispatchEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/dispatch-ended.integration-event';
import {
  DISPATCH_SUPERSEDED,
  type DispatchSupersededIntegrationEvent,
} from '@shared-kernel/application/integration-events/dispatch-superseded.integration-event';
import {
  PULL_REQUEST_OPENED,
  type PullRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import {
  PULL_REQUEST_REVIEW_TAKEN,
  type PullRequestReviewTakenIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-review-taken.integration-event';
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
import {
  TASK_RUN_ASSIGNED,
  type TaskRunAssignedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-run-assigned.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';
import type { ChatStarted } from '@work/domain/events/chat-started.event';
import type { DispatchBriefed } from '@work/domain/events/dispatch-briefed.event';
import type { DispatchEnded } from '@work/domain/events/dispatch-ended.event';
import type { DispatchSuperseded } from '@work/domain/events/dispatch-superseded.event';
import type { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import type { PullRequestReviewTaken } from '@work/domain/events/pull-request-review-taken.event';
import type { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import type { TaskAsked } from '@work/domain/events/task-asked.event';
import type { TaskDeleted } from '@work/domain/events/task-deleted.event';
import type { TaskFailed } from '@work/domain/events/task-failed.event';
import type { TaskMoved } from '@work/domain/events/task-moved.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';
import type { TaskPassed } from '@work/domain/events/task-passed.event';
import type { TaskRunAssigned } from '@work/domain/events/task-run-assigned.event';

export const WORK_EVENT_MAPPERS = [
  mapping<DispatchBriefed>(
    'dispatch.briefed',
    (event): DispatchBriefedIntegrationEvent => ({
      kind: DISPATCH_BRIEFED,
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
  mapping<TaskRunAssigned>(
    'task.run-assigned',
    (event): TaskRunAssignedIntegrationEvent => ({
      kind: TASK_RUN_ASSIGNED,
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
  mapping<DispatchEnded>(
    'dispatch.ended',
    (event): DispatchEndedIntegrationEvent => ({
      kind: DISPATCH_ENDED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      taskId: event.taskId?.value ?? null,
      stationId: event.stationId?.value ?? null,
      outcome: event.ending.outcome,
      failure: event.ending.failure,
      stopped: event.ending.stopped,
      asked: event.ending.askedAPerson,
    }),
  ),
  mapping<DispatchSuperseded>(
    'dispatch.superseded',
    (event): DispatchSupersededIntegrationEvent => ({
      kind: DISPATCH_SUPERSEDED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      taskId: event.taskId.value,
      at: event.at.toISOString(),
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
