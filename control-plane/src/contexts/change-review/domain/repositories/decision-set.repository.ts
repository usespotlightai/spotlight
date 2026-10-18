import type { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface DecisionSetRepository {
  add(set: DecisionSet): Promise<void>;

  save(set: DecisionSet): Promise<void>;

  forTask(taskId: TaskId): Promise<DecisionSet | null>;

  nextDueJob(now: Date): Promise<DecisionSet | null>;

  removeForTask(taskId: TaskId): Promise<void>;
}
