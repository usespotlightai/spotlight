import type { BindableTaskEvent } from '@work/application/contracts/bindable-task-events.contract';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Mark } from '@work/domain/value-objects/mark.vo';

export const OUTBOUND_TASK_NOTIFIER = Symbol('OUTBOUND_TASK_NOTIFIER');

export interface OutboundTaskNotifierPort {
  notify(task: Task, event: BindableTaskEvent): Promise<readonly Mark[]>;
}
