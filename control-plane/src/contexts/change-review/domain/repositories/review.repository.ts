import type { Review } from '@change-review/domain/aggregates/review.aggregate';
import type { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface ReviewRepository {
  add(review: Review): Promise<void>;

  save(review: Review): Promise<void>;

  find(id: ReviewId): Promise<Review | null>;

  removeForTask(taskId: TaskId): Promise<void>;
}
