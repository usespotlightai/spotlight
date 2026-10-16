import type { RunnerAdmissionsPort } from '@runners/application/ports/runner-admissions.port';
import type {
  PoolAtWork,
  RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import type {
  KeptPool,
  RunnerResourcesPort,
} from '@runners/application/ports/runner-resources.port';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';

const PLATFORM = 'spotlight';

const goesOut = (egress: string | null, platform: boolean): boolean =>
  egress !== null && (egress !== PLATFORM || platform);

export class RunnerPools implements RunnerPoolsPort {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly runners: RunnerRepository,
    private readonly resources: RunnerResourcesPort,
    private readonly admissions: RunnerAdmissionsPort,
    private readonly platform: boolean,
  ) {}

  async pulledWith(
    token: string | undefined,
    poolId: string,
  ): Promise<PoolAtWork | null> {
    const admitted = await this.admissions.admit({
      bearer: token,
      trust: undefined,
    });

    if (admitted?.way.kind !== 'pool') {
      return null;
    }

    const id = RunnerPoolId.of(admitted.way.id);
    const pool = id.equals(RunnerPoolId.of(poolId))
      ? await this.pools.find(id)
      : null;

    return pool
      ? {
          poolId: pool.id.value,
          workspaceId: pool.workspaceId,
          key: pool.key.value,
          labels: RunnerTerms.of(pool.labels.values),
          egress: goesOut(pool.egress?.value ?? null, this.platform),
        }
      : null;
  }

  async provisioning(): Promise<readonly PoolAtWork[]> {
    return (await this.resources.provisioningPools()).map((pool) =>
      this.atWork(pool),
    );
  }

  async running(poolId: string, now: Date): Promise<number> {
    return (await this.runners.standingIn(RunnerPoolId.of(poolId), now)).length;
  }

  async roomIn(poolId: string, now: Date): Promise<number | null> {
    const id = RunnerPoolId.of(poolId);
    const pool = await this.pools.find(id);

    return pool
      ? pool.roomFor((await this.runners.standingIn(id, now)).length)
      : 0;
  }

  private atWork(pool: KeptPool): PoolAtWork {
    return {
      poolId: pool.id,
      workspaceId: pool.workspaceId,
      key: pool.key,
      labels: RunnerTerms.of(pool.labels),
      egress: goesOut(pool.provision?.egress ?? null, this.platform),
    };
  }
}
