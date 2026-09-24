import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
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

  dueForCheck(by: CheckClaimant, now: Date): Promise<StackCheck | null>;

  isClaimedBy(runId: string, runner: RunnerId, now: Date): Promise<boolean>;

  removeForStacks(stackIds: readonly ChangeStackId[]): Promise<void>;
}
