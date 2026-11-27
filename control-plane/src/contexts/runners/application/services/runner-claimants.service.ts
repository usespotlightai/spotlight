import type {
  RunnerSource,
  RegisteredClaimant,
  RunnerClaimant,
  RunnerClaimantsPort,
} from '@runners/application/ports/runner-claimants.port';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const claimantOf = (
  runner: Runner | null,
  at: Date,
): RunnerClaimant | null =>
  runner?.isAlive(at) === true
    ? {
        workspaceId: runner.workspaceId,
        harnesses: runner.harnesses,
        offer: runner.offer,
        claims: runner.claimsAt(at),
      }
    : null;

export class RunnerClaimants implements RunnerClaimantsPort {
  constructor(
    private readonly runners: RunnerRepository,
    private readonly pools: RunnerPoolRepository,
    private readonly trusts: RunnerTrustRepository,
  ) {}

  async claimantOf(
    runnerId: RunnerId,
    at: Date,
  ): Promise<RunnerClaimant | null> {
    return claimantOf(await this.runners.find(runnerId), at);
  }

  async registeredClaimantOf(
    runnerId: RunnerId,
    at: Date,
  ): Promise<RegisteredClaimant | null> {
    const runner = await this.runners.find(runnerId);
    const claimant = claimantOf(runner, at);

    return runner && claimant
      ? { ...claimant, source: await this.sourceOf(runner) }
      : null;
  }

  // A run keeps this key once the runner claims it, so the key is read now and not later.
  private async sourceOf(runner: Runner): Promise<RunnerSource | null> {
    const { poolId, trustId } = runner.source;

    if (poolId) {
      const pool = await this.pools.find(poolId);

      return pool
        ? { kind: 'pool', key: pool.key.value, platform: runner.isPlatform }
        : null;
    }

    const trust = trustId ? await this.trusts.find(trustId) : null;

    return trust
      ? { kind: 'trust', key: trust.key.value, platform: false }
      : null;
  }
}
