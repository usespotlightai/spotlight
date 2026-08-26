import type { RunnerRevocationPort } from '@application/ports/runner-revocation.port';
import type { RunnerRevoked } from '@domain/events/runner-revoked.event';
import type { RunRepository } from '@domain/repositories/run.repository';

/**
 * A revoked runner cannot renew a lease or report an outcome, so whatever it
 * was holding is already abandoned. Putting it back now rather than waiting
 * for the lease to lapse is the difference between a run resuming at once and
 * one that sits claimed by nobody for a minute.
 */
export class ReleaseHeldRuns implements RunnerRevocationPort {
  constructor(private readonly runs: RunRepository) {}

  async onRunnerRevoked(event: RunnerRevoked): Promise<void> {
    await this.runs.releaseClaimedBy(event.runnerId);
  }
}
