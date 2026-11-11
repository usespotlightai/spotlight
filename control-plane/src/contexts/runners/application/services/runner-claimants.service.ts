import type {
  RunnerClaimant,
  RunnerClaimantsPort,
} from '@runners/application/ports/runner-claimants.port';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const claimantOf = (
  runner: Runner | null,
  at: Date,
): RunnerClaimant | null =>
  runner?.isAlive(at)
    ? {
        workspaceId: runner.workspaceId,
        harnesses: runner.harnesses,
        offer: runner.offer,
        claims: runner.claimsAt(at),
      }
    : null;

export class RunnerClaimants implements RunnerClaimantsPort {
  constructor(private readonly runners: RunnerRepository) {}

  async claimantOf(
    runnerId: RunnerId,
    at: Date,
  ): Promise<RunnerClaimant | null> {
    return claimantOf(await this.runners.find(runnerId), at);
  }
}
