import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const REVIEW_OUTBOX = Symbol('REVIEW_OUTBOX');

export const REVIEW_OUTBOX_KINDS = [
  'review',
  'reply',
  'file',
  'edit',
  'delete',
] as const;

export type ReviewOutboxKind = (typeof REVIEW_OUTBOX_KINDS)[number];

export interface ReviewDelivery {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly kind: ReviewOutboxKind;
  readonly subjectId: string;
}

export interface ReviewOutboxEntry extends ReviewDelivery {
  readonly attempts: number;
  readonly leaseUntil: Date;
}

export interface ReviewOutboxPort {
  enqueue(delivery: ReviewDelivery, dueAt: Date): Promise<void>;

  claimDue(now: Date, leaseUntil: Date): Promise<ReviewOutboxEntry | null>;

  done(entry: ReviewOutboxEntry): Promise<void>;

  later(
    entry: ReviewOutboxEntry,
    dueAt: Date,
    attempted: boolean,
  ): Promise<void>;

  failed(entry: ReviewOutboxEntry): Promise<void>;

  dropTask(taskId: TaskId): Promise<void>;
}
