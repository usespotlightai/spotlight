import type { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import type { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import type { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ReviewCommentRepository {
  add(comment: ReviewComment): Promise<void>;

  save(comment: ReviewComment): Promise<void>;

  find(id: ReviewCommentId): Promise<ReviewComment | null>;

  onGitHub(
    workspaceId: WorkspaceId,
    githubId: number,
  ): Promise<ReviewComment | null>;

  draftsOn(taskId: TaskId): Promise<ReviewComment[]>;

  ofTask(taskId: TaskId): Promise<ReviewComment[]>;

  onFile(taskId: TaskId, path: FilePath): Promise<ReviewComment[]>;

  remove(comment: ReviewComment): Promise<void>;
}
