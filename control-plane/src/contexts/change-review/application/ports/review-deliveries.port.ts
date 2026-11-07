import type { DeliveryRetry } from '@change-review/domain/value-objects/delivery-attempts.vo';
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

export interface ReviewDelivery {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly kind: ReviewDeliveryKind;
  readonly subjectId: string;
}

export interface LeasedReviewDelivery extends ReviewDelivery {
  readonly attempts: number;
  readonly leaseUntil: Date;
}

export interface ReviewDeliveriesPort {
  enqueue(delivery: ReviewDelivery, dueAt: Date): Promise<void>;

  leaseDue(now: Date, leaseUntil: Date): Promise<LeasedReviewDelivery | null>;

  delivered(delivery: LeasedReviewDelivery): Promise<void>;

  retry(delivery: LeasedReviewDelivery, retry: DeliveryRetry): Promise<void>;

  failed(delivery: LeasedReviewDelivery): Promise<void>;

  dropTask(taskId: TaskId): Promise<void>;
}
