import type {
  PoolAtWork,
  RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import type {
  KeptPool,
  RunnerResourcesPort,
} from '@runners/application/ports/runner-resources.port';
import type { PoolRunnerRepository } from '@runners/domain/repositories/pool-runner.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

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
    private readonly runners: PoolRunnerRepository,
    private readonly resources: RunnerResourcesPort,
    private readonly tokens: TokenMintPort,
  ) {}

  async pulledWith(token: string | undefined): Promise<PoolAtWork | null> {
    if (!token) {
      return null;
    }

    const pool = await this.pools.findByTokenHash(
      TokenHash.of(this.tokens.hash(token)),
    );

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
