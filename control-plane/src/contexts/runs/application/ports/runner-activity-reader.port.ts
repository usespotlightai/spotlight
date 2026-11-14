import type {
  RunPolicyContract,
  RunRequesterContract,
} from '@runs/application/contracts/run-order.contract';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_ACTIVITY_READER = Symbol('RUNNER_ACTIVITY_READER');

export interface ActivityRunRow {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly state: string;
  readonly requester: RunRequesterContract;
  readonly policy: RunPolicyContract;
  readonly teamId: string | null;
}

export interface RunnerActivityRow extends ActivityRunRow {
  readonly runnerId: string;
}

export interface WorkingCopyRunRow extends ActivityRunRow {
  readonly workingCopyKey: string;
}

export interface RunnerActivityReaderPort {
  leasedIn(workspaceId: WorkspaceId): Promise<readonly RunnerActivityRow[]>;

  lastRunsOf(
    workspaceId: WorkspaceId,
    keys: readonly string[],
  ): Promise<readonly WorkingCopyRunRow[]>;
}
