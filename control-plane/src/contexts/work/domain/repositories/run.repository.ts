import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Claimant } from '@work/domain/value-objects/claimant';
import type { ResumeKey } from '@work/domain/value-objects/resume-key.vo';

export interface RunRepository {
  add(run: Run): Promise<void>;

  // Must be atomic and follow ClaimOrder. Two runners must never claim the same run.
  claimNext(by: Claimant, now: Date): Promise<Run | null>;

  findById(id: RunId): Promise<Run | null>;

  newestWithKey(workspaceId: WorkspaceId, key: ResumeKey): Promise<Run | null>;

  queuedWithKey(
    workspaceId: WorkspaceId,
    key: ResumeKey,
  ): Promise<readonly Run[]>;

  expiredLeases(now: Date): Promise<readonly Run[]>;

  claimedBy(runner: RunnerId): Promise<readonly Run[]>;

  reservedFor(runner: RunnerId): Promise<Run | null>;

  awaitingProvision(
    workspaceId: WorkspaceId,
    now: Date,
    page: {
      readonly skip: number;
      readonly max: number;
      readonly withSecrets: boolean;
      readonly avoiding: readonly ResumeKey[];
    },
  ): Promise<readonly Run[]>;

  withExpiredReservations(now: Date): Promise<readonly Run[]>;

  save(run: Run): Promise<void>;
}
