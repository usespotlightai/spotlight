import { publishing } from '@shared-kernel/application/ports/event-publication.port';
import {
  PULL_REQUEST_OPENED,
  type PullRequestOpenedIntegrationEvent,
} from '@work/application/integration-events/pull-request-opened.integration-event';
import {
  TASK_DELETED,
  type TaskDeletedIntegrationEvent,
} from '@work/application/integration-events/task-deleted.integration-event';
import type { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import type { TaskDeleted } from '@work/domain/events/task-deleted.event';

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
] as const;
