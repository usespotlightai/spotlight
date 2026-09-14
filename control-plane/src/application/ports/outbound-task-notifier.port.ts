import type { Task } from '@domain/aggregates/task.aggregate';
import type { Mark } from '@domain/value-objects/mark.vo';

export const OUTBOUND_TASK_NOTIFIER = Symbol('OUTBOUND_TASK_NOTIFIER');

export interface OutboundTaskNotifierPort {
  notify(task: Task, event: string): Promise<readonly Mark[]>;
}

export class SilentTaskNotifier implements OutboundTaskNotifierPort {
  async notify(): Promise<readonly Mark[]> {
    return [];
  }
}
