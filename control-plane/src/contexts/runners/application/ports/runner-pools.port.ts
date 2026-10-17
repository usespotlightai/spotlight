import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_POOLS = Symbol('RUNNER_POOLS');

export interface PoolAtWork {
  readonly poolId: string;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly labels: RunnerTerms;
  readonly egress: boolean;
}

export interface RunnerPoolsPort {
  pulledWith(
    token: string | undefined,
    poolId: string,
  ): Promise<PoolAtWork | null>;

  provisioning(): Promise<readonly PoolAtWork[]>;

  running(poolId: string, now: Date): Promise<number>;

  roomIn(poolId: string, now: Date): Promise<number | null>;
}
