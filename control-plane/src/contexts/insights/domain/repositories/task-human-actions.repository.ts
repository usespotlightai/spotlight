import type { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface TaskHumanActionsRepository extends ScopedRemoval<TaskHumanActions> {
  add(humanActions: TaskHumanActions): Promise<void>;

  save(humanActions: TaskHumanActions): Promise<void>;

  of(taskId: TaskId): Promise<TaskHumanActions | null>;

  ofTasks(taskIds: readonly TaskId[]): Promise<readonly TaskHumanActions[]>;
}
