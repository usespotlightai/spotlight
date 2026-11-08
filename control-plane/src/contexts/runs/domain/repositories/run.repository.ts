import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type {
  ClaimCursor,
  QueuedRuns,
} from '@runs/domain/services/claim-order';
import type { Claimant } from '@runs/domain/value-objects/claimant';
import type { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import type { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUN_REPOSITORY = Symbol('RUN_REPOSITORY');

export interface RunRepository {
  add(run: Run): Promise<void>;

  claimCandidates(
    by: Claimant,
    now: Date,
    page: { readonly max: number; readonly after: ClaimCursor | null },
  ): Promise<QueuedRuns>;

  leasedAmong(
    requesters: readonly RunRequester[],
  ): Promise<readonly RunRequester[]>;

  findById(id: RunId): Promise<Run | null>;

  newestWithKey(
    workspaceId: WorkspaceId,
    key: WorkingCopyKey,
  ): Promise<Run | null>;

  queuedWithKey(
    workspaceId: WorkspaceId,
    key: WorkingCopyKey,
  ): Promise<readonly Run[]>;

  queuedFirstRuns(
    workspaceId: WorkspaceId,
    page: {
      readonly line: string;
      readonly avoiding: readonly WorkingCopyKey[];
      readonly queuedSince: Date;
      readonly max: number;
    },
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
      readonly avoiding: readonly WorkingCopyKey[];
    },
  ): Promise<QueuedRuns>;

  withExpiredReservations(now: Date): Promise<readonly Run[]>;

  save(run: Run): Promise<void>;
}
