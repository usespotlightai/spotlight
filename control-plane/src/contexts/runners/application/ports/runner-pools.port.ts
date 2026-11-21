import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_POOLS = Symbol('RUNNER_POOLS');

export interface PoolAtWork {
  readonly poolId: string;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly labels: RunnerOffer;
  readonly egress: boolean;
  // The deployment manages the pool and its provisioner.
  readonly managed: boolean;
}

export interface RunnerPoolsPort {
  pulledWith(
    token: string | undefined,
    poolId: string,
  ): Promise<PoolAtWork | null>;

  // The pools that Spotlight can ask for runners in these workspaces now.
  provisioning(
    workspaceIds: readonly WorkspaceId[],
  ): Promise<readonly PoolAtWork[]>;

  running(poolId: string, now: Date): Promise<number>;

  roomIn(poolId: string, now: Date): Promise<number | null>;
}
