import type { TaskActions } from '@insights/domain/aggregates/task-actions.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface TaskActionsRepository extends ScopedRemoval<TaskActions> {
  add(taskActions: TaskActions): Promise<void>;

  save(taskActions: TaskActions): Promise<void>;

  of(taskId: TaskId): Promise<TaskActions | null>;

  ofTasks(taskIds: readonly TaskId[]): Promise<readonly TaskActions[]>;
}
