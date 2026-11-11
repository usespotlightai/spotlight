import type { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import type { TaskAsked } from '@work/domain/events/task-asked.event';
import type { TaskFailed } from '@work/domain/events/task-failed.event';
import type { TaskFinished } from '@work/domain/events/task-finished.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';

export type NoticedTaskEvent =
  | TaskOpened
  | PullRequestOpened
  | TaskAsked
  | TaskFinished
  | TaskFailed;

export const notifiesOutsideTools = (event: NoticedTaskEvent): boolean =>
  event.kind !== 'task.opened' || event.fromIntegration;
