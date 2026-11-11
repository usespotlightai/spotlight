import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import type {
  PoolAtWork,
  RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import type {
  RunnerPoolRecord,
  RunnerResourcesPort,
} from '@runners/application/ports/runner-resources.port';
import type { SandboxPlacementsPort } from '@runners/application/ports/sandbox-placements.port';
import { occupancyOf } from '@runners/application/services/pool-occupancy';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import type { PoolOccupancy } from '@runners/domain/value-objects/pool-occupancy.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';

export class RunnerPools implements RunnerPoolsPort {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly runners: RunnerRepository,
    private readonly placements: SandboxPlacementsPort,
    private readonly resources: RunnerResourcesPort,
    private readonly authenticator: RunnerAuthenticatorPort,
    private readonly platform: boolean,
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

    return pool
      ? {
          poolId: pool.id.value,
          workspaceId: pool.workspaceId,
          key: pool.key.value,
          labels: RunnerOffer.of(pool.labels.values),
          egress: pool.egress?.usableWith(this.platform) ?? false,
        }
      : null;
  }

  async provisioning(): Promise<readonly PoolAtWork[]> {
    return (await this.resources.provisioningPools()).map((pool) =>
      this.atWork(pool),
    );
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

  private atWork(pool: RunnerPoolRecord): PoolAtWork {
    return {
      poolId: pool.id,
      workspaceId: pool.workspaceId,
      key: pool.key,
      labels: RunnerOffer.of(pool.labels),
      egress: pool.provision?.egress
        ? EgressReference.of(pool.provision.egress).usableWith(this.platform)
        : false,
    };
  }
}
