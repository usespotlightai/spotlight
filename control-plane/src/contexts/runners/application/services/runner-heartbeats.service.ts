import type {
  RunnerHeartbeat,
  RunnerHeartbeatsPort,
} from '@runners/application/ports/runner-heartbeats.port';
import { reviseRunner } from '@runners/application/services/runner-revisions';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RunnerHeartbeats implements RunnerHeartbeatsPort {
  constructor(private readonly runners: RunnerRepository) {}

  async heartbeat(
    runnerId: RunnerId,
    at: Date,
  ): Promise<RunnerHeartbeat | null> {
    const runner = await reviseRunner(this.runners, runnerId, (found) =>
      found.isAlive(at) ? found.heartbeat(at) : found,
    );

    return runner?.isAlive(at)
      ? {
          workspaceId: runner.workspaceId,
          harnesses: runner.harnesses,
          terms: runner.terms,
          claims: runner.claimsAt(at),
        }
      : null;
  }
}
