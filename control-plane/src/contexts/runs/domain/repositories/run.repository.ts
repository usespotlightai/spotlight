import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type { QueuedRuns } from '@runs/domain/services/claim-order';
import type { Claimant } from '@runs/domain/value-objects/claimant';
import type { RequesterOwner } from '@runs/domain/value-objects/run-requester.vo';
import type { RunTurnState } from '@runs/domain/value-objects/run-turn.vo';
import type { WorkspaceKey } from '@runs/domain/value-objects/workspace-key.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunRepository {
  add(run: Run): Promise<void>;

  claimCandidates(by: Claimant, now: Date, max: number): Promise<QueuedRuns>;

  findById(id: RunId): Promise<Run | null>;

  findByIds(ids: readonly RunId[]): Promise<readonly Run[]>;

  newestWithKey(
    workspaceId: WorkspaceId,
    key: WorkspaceKey,
  ): Promise<Run | null>;

  queuedWithKey(
    workspaceId: WorkspaceId,
    key: WorkspaceKey,
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
      readonly avoiding: readonly WorkspaceKey[];
    },
  ): Promise<QueuedRuns>;

  withExpiredReservations(now: Date): Promise<readonly Run[]>;

  turnsSuspendedBefore(
    owner: RequesterOwner,
    turn: RunTurnState,
    before: Date,
    after: { readonly suspendedAt: Date; readonly id: RunId } | null,
    max: number,
  ): Promise<readonly Run[]>;

  save(run: Run): Promise<void>;
}
