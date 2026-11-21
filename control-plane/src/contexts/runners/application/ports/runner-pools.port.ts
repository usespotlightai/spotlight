import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_POOLS = Symbol('RUNNER_POOLS');

export interface PoolAtWork {
  readonly poolId: string;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly labels: RunnerOffer;
  readonly egress: boolean;
  // Spotlight adds the platform pool to each workspace with the provisioner of the deployment.
  readonly platform: boolean;
}

// What the hosts of a pull pool or a trust can take. It names no pool, because Spotlight asks no host for a runner.
export interface HostOfferAtWork {
  readonly workspaceId: WorkspaceId;
  readonly labels: RunnerOffer;
  // A host injects secrets through its own egress.
  readonly egress: boolean;
}

export interface OffersAtWork {
  readonly pools: readonly PoolAtWork[];
  readonly hosts: readonly HostOfferAtWork[];
}

export interface RunnerPoolsPort {
  pulledWith(
    token: string | undefined,
    poolId: string,
  ): Promise<PoolAtWork | null>;

  // The pools of these workspaces that Spotlight can ask for runners now, and what their hosts can take, so that such work stays off the platform pool.
  offersIn(workspaceIds: readonly WorkspaceId[]): Promise<OffersAtWork>;

  running(poolId: string, now: Date): Promise<number>;

  roomIn(poolId: string, now: Date): Promise<number | null>;
}
