import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface CheckClaimant {
  readonly workspaceId: WorkspaceId;
  readonly runner: RunnerId;
  readonly terms: RunnerTerms;
}

export interface StackCheckRepository {
  add(check: StackCheck): Promise<void>;

  save(check: StackCheck): Promise<void>;

  find(stackId: ChangeStackId): Promise<StackCheck | null>;

  ofRun(runId: RunId): Promise<readonly StackCheck[]>;

  ofTask(taskId: TaskId): Promise<readonly StackCheck[]>;

  remove(check: StackCheck): Promise<void>;

  dueForCheck(by: CheckClaimant, now: Date): Promise<StackCheck | null>;

  reservedTo(runner: RunnerId, now: Date): Promise<StackCheck | null>;

  overdue(now: Date, most: number): Promise<readonly StackCheck[]>;

  awaitingProvision(
    workspaceId: WorkspaceId,
    now: Date,
    page: { readonly skip: number; readonly most: number },
  ): Promise<readonly StackCheck[]>;

  withLapsedReservations(now: Date): Promise<readonly StackCheck[]>;

  waitingIn(
    workspaceId: WorkspaceId,
    now: Date,
  ): Promise<readonly StackCheck[]>;
}
