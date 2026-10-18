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

export interface ReviewOutboxEntry {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly kind: ReviewOutboxKind;
  readonly subjectId: string;
  readonly attempts: number;
}

export interface ReviewOutboxPort {
  enqueue(
    sync: Omit<ReviewOutboxEntry, 'attempts'>,
    dueAt: Date,
  ): Promise<void>;

  claimDue(now: Date, leaseUntil: Date): Promise<ReviewOutboxEntry | null>;

  done(id: string): Promise<void>;

  later(
    id: string,
    dueAt: Date,
    failure: string | null,
    attempted: boolean,
  ): Promise<void>;

  failed(id: string, failure: string): Promise<void>;

  failuresFor(taskId: TaskId): Promise<ReadonlyMap<string, string>>;

  deleteTask(taskId: TaskId): Promise<void>;
}
