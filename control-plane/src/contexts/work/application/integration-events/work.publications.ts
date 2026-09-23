import {
  LINE_OPENED,
  type LineOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-opened.integration-event';
import {
  LINE_REDEFINED,
  type LineRedefinedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-redefined.integration-event';
import {
  LINE_RETIRED,
  type LineRetiredIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-retired.integration-event';
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
import type { LineOpened } from '@work/domain/events/line-opened.event';
import type { LineRedefined } from '@work/domain/events/line-redefined.event';
import type { LineRetired } from '@work/domain/events/line-retired.event';
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

const lineFields = (event: LineOpened | LineRedefined | LineRetired) => ({
  lineId: event.lineId.value,
  workspaceId: event.workspaceId.value,
  teamId: event.teamId.value,
  key: event.key.value,
});

export const WORK_PUBLICATIONS = [
  publishing<LineOpened>(
    'line.opened',
    (event): LineOpenedIntegrationEvent => ({
      kind: LINE_OPENED,
      ...lineFields(event),
    }),
  ),
  publishing<LineRedefined>(
    'line.redefined',
    (event): LineRedefinedIntegrationEvent => ({
      kind: LINE_REDEFINED,
      ...lineFields(event),
    }),
  ),
  publishing<LineRetired>(
    'line.retired',
    (event): LineRetiredIntegrationEvent => ({
      kind: LINE_RETIRED,
      ...lineFields(event),
    }),
  ),
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
