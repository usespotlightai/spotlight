import type { BindableTaskEvent } from '@work/application/contracts/bindable-task-events.contract';
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

const BOUND_AS: Readonly<Record<NoticedTaskEvent['kind'], BindableTaskEvent>> =
  {
    'task.opened': 'task.opened',
    'task.pull-request-opened': 'task.pull-request-opened',
    'task.asked': 'task.asked',
    'task.finished': 'task.finished',
    'task.failed': 'task.failed',
  };

export const NOTICED_TASK_EVENT_KINDS = Object.keys(
  BOUND_AS,
) as readonly NoticedTaskEvent['kind'][];

export const bindableTaskEventOf = (
  event: NoticedTaskEvent,
): BindableTaskEvent => BOUND_AS[event.kind];
