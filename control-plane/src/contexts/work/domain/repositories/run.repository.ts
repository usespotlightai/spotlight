import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';

type Claims = 'any' | 'reserved';

export interface Claimant {
  readonly runner: RunnerId;
  readonly workspaceId: WorkspaceId;
  readonly harnesses: readonly HarnessId[];
  readonly terms: RunnerTerms;
  readonly claims: Claims;
}

export interface KeptWithRun {
  readonly briefed?: BriefedTask;
}

export interface RunRepository {
  add(run: Run, kept?: KeptWithRun): Promise<void>;

  // Must be atomic and follow ClaimOrder. Two runners must never claim the same run.
  claimNext(by: Claimant, now: Date): Promise<Run | null>;

  findById(id: RunId): Promise<Run | null>;

  lapsedClaims(now: Date): Promise<readonly Run[]>;

  claimedBy(runner: RunnerId): Promise<readonly Run[]>;

  reservedFor(runner: RunnerId): Promise<Run | null>;

  awaitingProvision(
    workspaceId: WorkspaceId,
    now: Date,
    page: {
      readonly skip: number;
      readonly most: number;
      readonly withSecrets: boolean;
    },
  ): Promise<readonly Run[]>;

  withLapsedReservations(now: Date): Promise<readonly Run[]>;

  save(run: Run): Promise<void>;
}
