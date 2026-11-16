import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const REVIEW_WORK_ACCESS = Symbol('REVIEW_WORK_ACCESS');

export interface LeasedReviewWork {
  readonly runId: RunId | null;
  readonly taskId: TaskId | null;
  readonly repository: string | null;
}

export interface ReviewWorkAccessPort {
  leasedWork(
    work: { readonly kind: 'check' | 'diff'; readonly id: string },
    runner: RunnerId,
    now: Date,
  ): Promise<LeasedReviewWork | null>;
}
