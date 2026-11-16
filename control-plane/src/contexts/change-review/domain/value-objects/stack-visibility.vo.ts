import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export type StackVisibility =
  | { readonly kind: 'task'; readonly taskId: TaskId }
  | { readonly kind: 'run'; readonly runId: RunId };

export const visibilityOf = (stack: {
  readonly taskId: TaskId | null;
  readonly runId: RunId | null;
}): StackVisibility | null => {
  if (stack.taskId) {
    return { kind: 'task', taskId: stack.taskId };
  }

  return stack.runId ? { kind: 'run', runId: stack.runId } : null;
};
