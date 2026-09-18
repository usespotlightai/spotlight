import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const REVIEW_READER = Symbol('REVIEW_READER');

export interface ReviewCommentView {
  readonly id: string;
  readonly path: string;
  readonly side: 'new' | 'old';
  readonly line: number;
  readonly startLine: number | null;
  readonly body: string;
  readonly authorId: string | null;
  readonly authorRunId: string | null;
  readonly authorLogin: string | null;
  readonly authorName: string;
  readonly replyTo: string | null;
  readonly reviewId: string | null;
  readonly state: 'draft' | 'submitted' | 'posted' | 'failed' | 'deleted';
  readonly url: string | null;
  readonly createdAt: Date;
  readonly editedAt: Date | null;
}

export interface ReviewView {
  readonly id: string;
  readonly authorId: string | null;
  readonly authorRunId: string | null;
  readonly authorName: string | null;
  readonly verdict: 'comment' | 'approve' | 'request-changes';
  readonly body: string;
  readonly state: 'submitted' | 'posted' | 'failed' | 'withdrawn';
  readonly submittedAt: Date;
}

export interface ReviewReaderPort {
  commentsVisibleTo(
    taskId: TaskId,
    viewer: UserId,
  ): Promise<ReviewCommentView[]>;

  reviewsOf(taskId: TaskId): Promise<ReviewView[]>;
}
