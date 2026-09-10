import type { Task } from '@domain/aggregates/task.aggregate';
import type { Mark } from '@domain/value-objects/mark.vo';

export const TASK_ASK_NOTIFIER = Symbol('TASK_ASK_NOTIFIER');

/**
 * Carries a task's question somewhere other than the inbox — a chat thread —
 * when the team has said to. Called as a task is put to a person; a team that
 * routes nothing simply does nothing. Returns the marks the caller should
 * record on the task, so it writes no aggregate itself.
 */
export interface TaskAskNotifierPort {
  onAsked(task: Task): Promise<readonly Mark[]>;
}

/** Does nothing, for a deployment that routes no asks anywhere. */
export class SilentAskNotifier implements TaskAskNotifierPort {
  async onAsked(): Promise<readonly Mark[]> {
    return [];
  }
}
