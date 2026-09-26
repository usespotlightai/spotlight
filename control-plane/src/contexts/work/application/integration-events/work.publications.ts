import {
  PULL_REQUEST_OPENED,
  type PullRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
  type RunEnding,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  TASK_DELETED,
  type TaskDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-deleted.integration-event';
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
import type { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import type { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
import type { TaskDeleted } from '@work/domain/events/task-deleted.event';
import type { TaskHandedToRun } from '@work/domain/events/task-handed-to-run.event';
import type { TaskMoved } from '@work/domain/events/task-moved.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';

const ended = (
  event: RunCompleted | RunAbandoned | RunWithdrawn,
  outcome: RunEnding,
): RunEndedIntegrationEvent => ({
  kind: RUN_ENDED,
  runId: event.runId.value,
  workspaceId: event.workspaceId.value,
  taskId: event.taskId?.value ?? null,
  outcome,
});

export const WORK_PUBLICATIONS = [
  publishing<PullRequestOpened>(
    'task.pull-request-opened',
    (event): PullRequestOpenedIntegrationEvent => ({
      kind: PULL_REQUEST_OPENED,
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
  publishing<RunCompleted>('run.completed', (event) =>
    ended(event, event.outcome.failed ? 'failed' : 'completed'),
  ),
  publishing<RunAbandoned>('run.abandoned', (event) =>
    ended(event, 'abandoned'),
  ),
  publishing<RunWithdrawn>('run.withdrawn', (event) =>
    ended(event, 'withdrawn'),
  ),
] as const;
