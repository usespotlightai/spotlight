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
  maxRuns: pool.maxRuns,
});

export class RunnerPools implements RunnerPoolsPort {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly runners: RunnerRepository,
    private readonly resources: RunnerResourcesPort,
    private readonly admissions: RunnerAdmissionsPort,
  ) {}

  async pulledWith(token: string | undefined): Promise<PoolAtWork | null> {
    const admitted = await this.admissions.admit({
      bearer: token,
      trust: undefined,
    });
    const pool =
      admitted?.way.kind === 'pool'
        ? await this.pools.find(RunnerPoolId.of(admitted.way.id))
        : null;

    return pool
      ? {
          poolId: pool.id.value,
          workspaceId: pool.workspaceId,
          key: pool.key.value,
          labels: RunnerTerms.of(pool.labels.values),
          maxRuns: pool.maxRuns?.value ?? null,
        }
      : null;
  }

  async provisioning(): Promise<readonly PoolAtWork[]> {
    return (await this.resources.provisioningPools()).map(atWork);
  }

  async running(poolId: string, now: Date): Promise<number> {
    return (await this.runners.standingIn(RunnerPoolId.of(poolId), now)).length;
  }
}
