import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const REVIEW_OUTBOX = Symbol('REVIEW_OUTBOX');

export const REVIEW_SYNC_KINDS = ['review', 'reply', 'edit', 'delete'] as const;

export type ReviewSyncKind = (typeof REVIEW_SYNC_KINDS)[number];

export interface ReviewSync {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly kind: ReviewSyncKind;
  readonly subjectId: string;
  readonly attempts: number;
}

export interface ReviewOutboxPort {
  enqueue(sync: Omit<ReviewSync, 'attempts'>, dueAt: Date): Promise<void>;

  claimDue(now: Date): Promise<ReviewSync | null>;

  done(id: string): Promise<void>;

  later(
    id: string,
    dueAt: Date,
    failure: string | null,
    attempted: boolean,
  ): Promise<void>;

  failed(id: string, failure: string): Promise<void>;

  failuresFor(taskId: TaskId): Promise<ReadonlyMap<string, string>>;

  forgetTask(taskId: TaskId): Promise<void>;
}
