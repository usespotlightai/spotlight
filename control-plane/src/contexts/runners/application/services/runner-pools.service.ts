import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import type {
  PoolAtWork,
  RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import type { SandboxPlacementsPort } from '@runners/application/ports/sandbox-placements.port';
import { occupancyOf } from '@runners/application/services/pool-occupancy';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { PoolOccupancy } from '@runners/domain/value-objects/pool-occupancy.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunnerPoolsSettings {
  readonly platformEgress: boolean;
  readonly platformPool: boolean;
}

export class RunnerPools implements RunnerPoolsPort {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly runners: RunnerRepository,
    private readonly placements: SandboxPlacementsPort,
    private readonly authenticator: RunnerAuthenticatorPort,
    private readonly settings: RunnerPoolsSettings,
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

  // The pull pools and trusts come too, so that work which hosts can take stays off the platform pool.
  async provisioning(
    workspaceIds: readonly WorkspaceId[],
  ): Promise<readonly PoolAtWork[]> {
    const [pools, trusts] = await Promise.all([
      this.pools.findAllByWorkspaces(workspaceIds),
      this.trusts.findAllByWorkspaces(workspaceIds),
    ]);

    return [
      ...pools
        .filter(
          (pool) =>
            pool.acceptsPullToken ||
            pool.canProvision(this.settings.platformPool),
        )
        .map((pool) => this.atWork(pool)),
      ...trusts.map((trust) => this.trustAtWork(trust)),
    ];
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
    const pulled = pool.mode === 'pull';

    return {
      poolId: pool.id.value,
      workspaceId: pool.workspaceId,
      key: pool.key.value,
      labels: RunnerOffer.of(pool.labels.values),
      egress:
        pulled ||
        (pool.egress?.usableWith(this.settings.platformEgress) ?? false),
      platform: pool.isPlatform,
      provisions: pool.canProvision(this.settings.platformPool),
    };
  }

  private trustAtWork(trust: RunnerTrust): PoolAtWork {
    return {
      poolId: trust.id.value,
      workspaceId: trust.workspaceId,
      key: trust.key.value,
      labels: RunnerOffer.of(trust.labels.values),
      egress: true,
      platform: false,
      provisions: false,
    };
  }
}
