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

const atWork = (pool: KeptPool): PoolAtWork => ({
  poolId: pool.id,
  workspaceId: pool.workspaceId,
  key: pool.key,
  labels: RunnerTerms.of(pool.labels),
});

export class RunnerPools implements RunnerPoolsPort {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly runners: RunnerRepository,
    private readonly resources: RunnerResourcesPort,
    private readonly admissions: RunnerAdmissionsPort,
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
        }
      : null;
  }

  async provisioning(): Promise<readonly PoolAtWork[]> {
    return (await this.resources.provisioningPools()).map(atWork);
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
}
