import type { RunnerRevocationPort } from '@application/ports/runner-revocation.port';
import type { RunnerRevoked } from '@domain/events/runner-revoked.event';
import type { RunRepository } from '@domain/repositories/run.repository';

export class ReleaseHeldRuns implements RunnerRevocationPort {
  constructor(private readonly runs: RunRepository) {}

  async onRunnerRevoked(event: RunnerRevoked): Promise<void> {
    await this.runs.releaseClaimedBy(event.runnerId);
  }
}
