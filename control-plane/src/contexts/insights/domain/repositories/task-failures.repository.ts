import type { TaskFailures } from '@insights/domain/aggregates/task-failures.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface TaskFailuresRepository extends ScopedRemoval<TaskFailures> {
  add(failures: TaskFailures): Promise<void>;

  save(failures: TaskFailures): Promise<void>;

  of(taskId: TaskId): Promise<TaskFailures | null>;
}
