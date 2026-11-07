import type { DeliveryRetry } from '@change-review/domain/value-objects/delivery-attempts.vo';
import type { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import type { ReviewDeliveryId } from '@change-review/domain/value-objects/review-delivery-id.vo';
import type { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const REVIEW_DELIVERIES = Symbol('REVIEW_DELIVERIES');

export const REVIEW_DELIVERY_KINDS = [
  'review',
  'reply',
  'file',
  'edit',
  'delete',
] as const;

export type ReviewDeliveryKind = (typeof REVIEW_DELIVERY_KINDS)[number];

type CommentDeliveryKind = Exclude<ReviewDeliveryKind, 'review'>;

export type ReviewDeliverySubject =
  | { readonly kind: 'review'; readonly subject: ReviewId }
  | { readonly kind: CommentDeliveryKind; readonly subject: ReviewCommentId };

export type ReviewDelivery = {
  readonly id: ReviewDeliveryId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
} & ReviewDeliverySubject;

export type LeasedReviewDelivery = ReviewDelivery & {
  readonly attempts: number;
  readonly leaseUntil: Date;
  readonly sendingSince: Date | null;
};

export interface ReviewDeliveriesPort {
  enqueue(delivery: ReviewDelivery, dueAt: Date): Promise<void>;

  leaseDue(now: Date, leaseUntil: Date): Promise<LeasedReviewDelivery | null>;

  sending(delivery: LeasedReviewDelivery, at: Date): Promise<boolean>;

  delivered(delivery: LeasedReviewDelivery): Promise<void>;

  retry(delivery: LeasedReviewDelivery, retry: DeliveryRetry): Promise<void>;

  failed(delivery: LeasedReviewDelivery): Promise<void>;

  dropTask(taskId: TaskId): Promise<void>;
}
