import type {
  RunPolicyContract,
  RunRequesterContract,
} from '@runs/application/contracts/run-order.contract';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const LEASED_RUN_KINDS = [
  'task',
  'chat',
  'replay',
  'search',
  'spec',
] as const;

export type LeasedRunKind = (typeof LEASED_RUN_KINDS)[number];

export const RUNNER_ACTIVITY_READER = Symbol('RUNNER_ACTIVITY_READER');

export interface LeasedRun {
  readonly runnerId: string;
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly state: string;
  readonly requester: RunRequesterContract;
  readonly policy: RunPolicyContract;
  readonly teamId: string | null;
}

export interface RunnerActivityReaderPort {
  leasedIn(workspaceId: WorkspaceId): Promise<readonly LeasedRun[]>;
}
