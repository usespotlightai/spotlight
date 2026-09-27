import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const REVIEWS = Symbol('REVIEWS');

export interface ReviewsPort {
  raise(taskId: TaskId, runId: RunId): Promise<void>;

  settle(taskId: TaskId, runId: RunId): Promise<void>;
}
