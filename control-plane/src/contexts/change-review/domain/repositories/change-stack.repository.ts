import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface ChangeStackRepository {
  add(stack: ChangeStack): Promise<void>;

  save(stack: ChangeStack): Promise<void>;

  find(id: ChangeStackId): Promise<ChangeStack | null>;

  dueForWork(now: Date): Promise<ChangeStack | null>;

  removeForTask(taskId: TaskId): Promise<void>;
}
