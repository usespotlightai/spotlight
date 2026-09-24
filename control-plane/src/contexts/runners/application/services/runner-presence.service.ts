import type {
  RunnerPresencePort,
  SeenRunner,
} from '@runners/application/ports/runner-presence.port';
import { reviseRunner } from '@runners/application/services/runner-revisions';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';

export class RunnerPresence implements RunnerPresencePort {
  constructor(
    private readonly runners: RunnerRepository,
    private readonly trusts: RunnerTrustRepository,
  ) {}

  async seen(runnerId: RunnerId, at: Date): Promise<SeenRunner | null> {
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
    };
  }

  async termsOf(runnerId: RunnerId): Promise<RunnerTerms> {
    const runner = await this.runners.find(runnerId);
    const trust = runner ? await this.trustOf(runner) : null;

    return runner?.standsWith(trust)
      ? runner.termsWith(trust)
      : RunnerTerms.none();
  }

  private trustOf(runner: Runner): Promise<RunnerTrust | null> {
    return runner.trustId
      ? this.trusts.find(runner.trustId)
      : Promise.resolve(null);
  }
}
