import type {
  RunPolicyContract,
  RunRequesterContract,
} from '@runs/application/contracts/run-order.contract';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUN_VIEWERS = Symbol('RUN_VIEWERS');

export interface WatchedRun {
  readonly runId: RunId;
  readonly attempt: number;
}

export interface ViewedRun {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly requester: RunRequesterContract;
  readonly policy: RunPolicyContract;
}

export interface RunViewersPort {
  watchedBy(runId: RunId, viewer: UserId): Promise<WatchedRun | null>;

  readableAmong(
    runs: readonly ViewedRun[],
    viewer: UserId,
  ): Promise<ReadonlySet<string>>;
}
