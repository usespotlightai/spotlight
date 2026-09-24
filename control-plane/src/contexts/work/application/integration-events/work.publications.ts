import {
  PULL_REQUEST_OPENED,
  type PullRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  TASK_DELETED,
  type TaskDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import {
  TASK_HANDED_TO_RUN,
  type TaskHandedToRunIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-handed-to-run.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';
import type { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import type { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
import type { TaskDeleted } from '@work/domain/events/task-deleted.event';
import type { TaskHandedToRun } from '@work/domain/events/task-handed-to-run.event';

const ended = (
  event: RunCompleted | RunAbandoned | RunWithdrawn,
): RunEndedIntegrationEvent => ({
  kind: RUN_ENDED,
  runId: event.runId.value,
  workspaceId: event.workspaceId.value,
  taskId: event.taskId?.value ?? null,
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
  publishing<RunCompleted>('run.completed', ended),
  publishing<RunAbandoned>('run.abandoned', ended),
  publishing<RunWithdrawn>('run.withdrawn', ended),
] as const;
