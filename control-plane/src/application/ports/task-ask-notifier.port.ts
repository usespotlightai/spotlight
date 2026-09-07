import type { Task } from '@domain/aggregates/task.aggregate';

export const TASK_ASK_NOTIFIER = Symbol('TASK_ASK_NOTIFIER');

/**
 * Carries a task's question somewhere other than the inbox — a chat thread —
 * when the team has said to. Called as a task is put to a person; a team that
 * routes nothing simply does nothing.
 */
export interface TaskAskNotifierPort {
  onAsked(task: Task): Promise<void>;
}

/** Does nothing, for a deployment that routes no asks anywhere. */
export class SilentAskNotifier implements TaskAskNotifierPort {
  async onAsked(): Promise<void> {}
}
