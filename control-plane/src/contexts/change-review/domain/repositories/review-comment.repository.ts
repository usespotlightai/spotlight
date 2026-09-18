import type { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import type { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ReviewCommentRepository {
  add(comment: ReviewComment): Promise<void>;

  save(comment: ReviewComment): Promise<void>;

  find(id: ReviewCommentId): Promise<ReviewComment | null>;

  onGitHub(
    workspaceId: WorkspaceId,
    githubId: number,
  ): Promise<ReviewComment | null>;

  draftsBy(taskId: TaskId, author: UserId): Promise<ReviewComment[]>;

  ofTask(taskId: TaskId): Promise<ReviewComment[]>;

  removeForTask(taskId: TaskId): Promise<void>;
}
