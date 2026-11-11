import type { TaskChangeShape } from '@insights/domain/aggregates/task-change-shape.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface TaskChangeShapeRepository
  extends ScopedRemoval<TaskChangeShape> {
  forTask(taskId: TaskId): Promise<TaskChangeShape | null>;

  add(shape: TaskChangeShape): Promise<void>;

  save(shape: TaskChangeShape): Promise<void>;
}
