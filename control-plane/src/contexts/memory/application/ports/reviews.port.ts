import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const REVIEWS = Symbol('REVIEWS');

export interface ReviewsPort {
  create(taskId: TaskId, runId: RunId): Promise<void>;

  resolve(taskId: TaskId, runId: RunId): Promise<void>;

  reviewItemOf(taskId: TaskId, runId: RunId): Promise<string | null>;
}
