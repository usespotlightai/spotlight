import type { PlatformSetup } from '@runners/application/ports/platform-setup.port';
import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import type {
  OffersAtWork,
  PoolAtWork,
  RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import type { SandboxPlacementsPort } from '@runners/application/ports/sandbox-placements.port';
import { occupancyOf } from '@runners/application/services/pool-occupancy';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { PoolOccupancy } from '@runners/domain/value-objects/pool-occupancy.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunnerPools implements RunnerPoolsPort {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly runners: RunnerRepository,
    private readonly placements: SandboxPlacementsPort,
    private readonly authenticator: RunnerAuthenticatorPort,
    private readonly setup: PlatformSetup,
  ) {}

  async pulledWith(
    token: string | undefined,
    poolId: string,
  ): Promise<PoolAtWork | null> {
    const authenticated = await this.authenticator.authenticate({
      bearer: token,
      trust: undefined,
    });

    if (authenticated?.source.kind !== 'pool') {
      return null;
    }

    const id = PoolId.of(authenticated.source.id);
    const pool = id.equals(PoolId.of(poolId))
      ? await this.pools.find(id)
      : null;

    return pool ? this.atWork(pool) : null;
  }

  async offersIn(workspaceIds: readonly WorkspaceId[]): Promise<OffersAtWork> {
    const [pools, trusts] = await Promise.all([
      this.pools.inWorkspaces(workspaceIds),
      this.trusts.inWorkspaces(workspaceIds),
    ]);

    return {
      pools: pools
        .filter((pool) => pool.canProvision(this.setup.platformPoolSet))
        .map((pool) => this.atWork(pool)),
      hostOffers: [
        ...pools.filter((pool) => pool.acceptsPullToken),
        ...trusts,
      ].map((source) => ({
        workspaceId: source.workspaceId,
        labels: RunnerOffer.of(source.labels.values),
        egress: true,
        images: null,
        allowsSecrets: true,
        allowsReviewWork: true,
      })),
    };
  }

  async running(poolId: string, now: Date): Promise<number> {
    return (await this.occupancyOf(PoolId.of(poolId), now)).runners;
  }

  async roomIn(poolId: string, now: Date): Promise<number | null> {
    const id = PoolId.of(poolId);
    const pool = await this.pools.find(id);

    return pool ? pool.roomFor(await this.occupancyOf(id, now)) : 0;
  }

  private occupancyOf(id: PoolId, now: Date): Promise<PoolOccupancy> {
    return occupancyOf(this.runners, this.placements, id, now);
  }

  private atWork(pool: RunnerPool): PoolAtWork {
    return {
      poolId: pool.id.value,
      workspaceId: pool.workspaceId,
      key: pool.key.value,
      labels: RunnerOffer.of(pool.labels.values),
      egress: pool.offersEgress(this.setup.platformEgressSet),
      platform: pool.isPlatform,
      images: pool.isPlatform ? this.setup.platformImages : null,
      allowsSecrets: pool.allowsSecrets,
      allowsReviewWork: pool.allowsReviewWork,
    };
  }
}
