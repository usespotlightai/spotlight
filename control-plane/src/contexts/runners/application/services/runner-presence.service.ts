import type {
  RunnerPresencePort,
  SeenRunner,
} from '@runners/application/ports/runner-presence.port';
import { reviseRunner } from '@runners/application/services/runner-revisions';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RunnerPresence implements RunnerPresencePort {
  constructor(private readonly runners: RunnerRepository) {}

  async seen(runnerId: RunnerId, at: Date): Promise<SeenRunner | null> {
    const seen = await reviseRunner(this.runners, runnerId, (runner) =>
      runner.seen(at),
    );

    return seen
      ? { workspaceId: seen.workspaceId, harnesses: seen.harnesses }
      : null;
  }
}
