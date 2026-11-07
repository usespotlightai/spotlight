import type { DeliveryFailureCode } from '@change-review/domain/value-objects/delivery-failure.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const REVIEW_READER = Symbol('REVIEW_READER');

export interface ReviewCommentView {
  readonly id: string;
  readonly path: string;
  readonly side: 'new' | 'old' | null;
  readonly line: number | null;
  readonly startLine: number | null;
  readonly body: string;
  readonly authorId: string | null;
  readonly authorRunId: string | null;
  readonly authorLogin: string | null;
  readonly authorName: string;
  readonly replyTo: string | null;
  readonly reviewId: string | null;
  readonly state: 'draft' | 'sending' | 'posted' | 'failed' | 'deleted';
  readonly url: string | null;
  readonly createdAt: Date;
  readonly editedAt: Date | null;
  readonly failureCode: DeliveryFailureCode | null;
  readonly failureDetail: string | null;
}

export interface ReviewView {
  readonly id: string;
  readonly authorId: string | null;
  readonly authorRunId: string | null;
  readonly authorName: string | null;
  readonly verdict: 'comment' | 'approve' | 'request-changes';
  readonly body: string;
  readonly state: 'submitted' | 'posted' | 'failed' | 'discarded';
  readonly submittedAt: Date;
  readonly failureCode: DeliveryFailureCode | null;
  readonly failureDetail: string | null;
}

export interface ReviewReaderPort {
  commentsOf(taskId: TaskId): Promise<ReviewCommentView[]>;

  reviewsOf(taskId: TaskId): Promise<ReviewView[]>;
}
