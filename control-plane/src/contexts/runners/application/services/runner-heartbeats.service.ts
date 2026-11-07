import type { RunnerClaimant } from '@runners/application/ports/runner-claimants.port';
import type { RunnerHeartbeatsPort } from '@runners/application/ports/runner-heartbeats.port';
import { claimantOf } from '@runners/application/services/runner-claimants.service';
import { reviseRunner } from '@runners/application/services/runner-revisions';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RunnerHeartbeats implements RunnerHeartbeatsPort {
  constructor(private readonly runners: RunnerRepository) {}

  async heartbeat(
    runnerId: RunnerId,
    at: Date,
  ): Promise<RunnerClaimant | null> {
    const runner = await reviseRunner(this.runners, runnerId, (found) =>
      found.isAlive(at) ? found.heartbeat(at) : found,
    );

    return claimantOf(runner, at);
  }
}
