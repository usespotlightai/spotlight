import type { Task } from '@domain/aggregates/task.aggregate';
import type { Mark } from '@domain/value-objects/mark.vo';

export const OUTBOUND_TASK_NOTIFIER = Symbol('OUTBOUND_TASK_NOTIFIER');

/**
 * Carries what happens to a task out to a chat thread, when the team has said
 * to. Called with the Spotlight event that happened — `task.opened` when a word
 * opens one, `task.asked` when it is put to a person — and runs whatever the
 * integration binds to that event; a team that binds nothing simply does
 * nothing. Returns the marks the caller should record on the task, so it writes
 * no aggregate itself.
 */
export interface OutboundTaskNotifierPort {
  notify(task: Task, event: string): Promise<readonly Mark[]>;
}

/** Does nothing, for a deployment that routes no events anywhere. */
export class SilentTaskNotifier implements OutboundTaskNotifierPort {
  async notify(): Promise<readonly Mark[]> {
    return [];
  }
}
