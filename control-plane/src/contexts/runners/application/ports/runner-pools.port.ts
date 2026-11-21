import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_POOLS = Symbol('RUNNER_POOLS');

export interface PoolAtWork {
  readonly poolId: string;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly labels: RunnerOffer;
  // The pool can take a run that injects secrets. A host injects them through its own egress.
  readonly egress: boolean;
  // Spotlight adds the platform pool to each workspace with the provisioner of the deployment.
  readonly platform: boolean;
  // Spotlight asks this pool for runners. Hosts pull the runners of the others.
  readonly provisions: boolean;
}

export interface RunnerPoolsPort {
  pulledWith(
    token: string | undefined,
    poolId: string,
  ): Promise<PoolAtWork | null>;

  // The pools and trusts of these workspaces, and which of them Spotlight can ask for runners now.
  provisioning(
    workspaceIds: readonly WorkspaceId[],
  ): Promise<readonly PoolAtWork[]>;

  running(poolId: string, now: Date): Promise<number>;

  roomIn(poolId: string, now: Date): Promise<number | null>;
}
