import type {
  RunnerPresencePort,
  SeenRunner,
} from '@runners/application/ports/runner-presence.port';
import { revisePoolRunner } from '@runners/application/services/pool-runner-revisions';
import { reviseRunner } from '@runners/application/services/runner-revisions';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { PoolRunnerRepository } from '@runners/domain/repositories/pool-runner.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';

export class RunnerPresence implements RunnerPresencePort {
  constructor(
    private readonly runners: RunnerRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly pooled: PoolRunnerRepository,
  ) {}

  async seen(runnerId: RunnerId, at: Date): Promise<SeenRunner | null> {
    const pooled = await revisePoolRunner(this.pooled, runnerId, (runner) =>
      runner.standsAt(at) ? runner.seen(at) : runner,
    );

    if (pooled) {
      return pooled.standsAt(at)
        ? {
            workspaceId: pooled.workspaceId,
            harnesses: pooled.harnesses,
            terms: pooled.terms,
            claims: pooled.claimsAt(at),
          }
        : null;
    }

    const seen = await reviseRunner(this.runners, runnerId, (runner) =>
      runner.seen(at),
    );
    const trust = seen ? await this.trustOf(seen) : null;

    if (!seen?.standsWith(trust)) {
      return null;
    }

    return {
      workspaceId: seen.workspaceId,
      harnesses: seen.harnesses,
      terms: seen.termsWith(trust),
      claims: 'any',
    };
  }

  async pinnableTerms(runnerId: RunnerId): Promise<RunnerTerms | null> {
    const runner = await this.runners.find(runnerId);
    const trust = runner ? await this.trustOf(runner) : null;

    return runner?.standsWith(trust) ? runner.termsWith(trust) : null;
  }

  private trustOf(runner: Runner): Promise<RunnerTrust | null> {
    return runner.trustId
      ? this.trusts.find(runner.trustId)
      : Promise.resolve(null);
  }
}
