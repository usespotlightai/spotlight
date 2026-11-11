import type { RunRequesterContract } from '@runs/application/contracts/run-order.contract';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUN_VIEWERS = Symbol('RUN_VIEWERS');

export interface ViewedRun {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly requester: RunRequesterContract;
}

export interface RunViewerSource {
  readonly owner: string;

  readableAmong(
    runs: readonly ViewedRun[],
    viewer: UserId,
  ): Promise<ReadonlySet<string>>;
}

export interface RunViewersPort {
  register(source: RunViewerSource): void;
}
