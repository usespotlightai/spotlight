import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Run } from '@work/domain/aggregates/run.aggregate';

export interface Claimant {
  readonly runner: RunnerId;
  readonly workspaceId: WorkspaceId;
  readonly harnesses: readonly HarnessId[];
}

export interface RunRepository {
  add(run: Run): Promise<void>;

  // Must be atomic and follow ClaimOrder: concurrent runners must never claim the same run.
  claimNext(by: Claimant, now: Date): Promise<Run | null>;

  findById(id: RunId): Promise<Run | null>;

  lapsedClaims(now: Date): Promise<readonly Run[]>;

  claimedBy(runner: RunnerId): Promise<readonly Run[]>;

  save(run: Run): Promise<void>;
}
