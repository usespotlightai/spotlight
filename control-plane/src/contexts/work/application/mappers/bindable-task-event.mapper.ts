import type { BindableTaskEvent } from '@work/application/contracts/bindable-task-events.contract';
import type { NoticedTaskEvent } from '@work/domain/services/outside-notices';

const BOUND_AS: Readonly<Record<NoticedTaskEvent['kind'], BindableTaskEvent>> =
  {
    'task.opened': 'task.opened',
    'task.pull-request-opened': 'task.pull-request-opened',
    'task.asked': 'task.asked',
    'task.finished': 'task.finished',
    'task.failed': 'task.failed',
  };

export const NOTICED_TASK_EVENT_KINDS: readonly NoticedTaskEvent['kind'][] =
  Object.keys(BOUND_AS).filter(
    (kind): kind is NoticedTaskEvent['kind'] => kind in BOUND_AS,
  );

export const bindableTaskEventOf = (
  event: NoticedTaskEvent,
): BindableTaskEvent => BOUND_AS[event.kind];
