import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_POOLS = Symbol('RUNNER_POOLS');

// What a pool, or the hosts of a pull pool or a trust, can take.
interface OfferAtWork {
  readonly workspaceId: WorkspaceId;
  readonly labels: RunnerOffer;
  // It can send the traffic of a run through an egress, which injects the run's secrets.
  readonly egress: boolean;
  // The images it runs. Null: any image, as for every pool of the workspace.
  readonly images: readonly RunnerImage[] | null;
  // The operator allows it runs that inject secrets. Only the platform pool can refuse them.
  readonly allowsSecrets: boolean;
  // The operator allows it checks and diffs. Only the platform pool can refuse them.
  readonly allowsReviewWork: boolean;
}

export interface PoolAtWork extends OfferAtWork {
  readonly poolId: string;
  readonly key: string;
  // Spotlight adds the platform pool to each workspace with the provisioner of the deployment.
  readonly platform: boolean;
}

// What the hosts of a pull pool or a trust can take. It names no pool, because Spotlight asks no host for a runner. A host injects secrets through its own egress.
export type HostOfferAtWork = OfferAtWork;

export interface OffersAtWork {
  readonly pools: readonly PoolAtWork[];
  readonly hostOffers: readonly HostOfferAtWork[];
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
