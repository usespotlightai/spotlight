import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerRevocationPort } from '@work/application/ports/runner-revocation.port';
import type { RunLeases } from '@work/application/services/run-leases.service';

export class ReleaseHeldRuns implements RunnerRevocationPort {
  constructor(private readonly leases: RunLeases) {}

  async onRunnerRevoked(runnerId: RunnerId): Promise<void> {
    await this.leases.releaseHeldBy(runnerId);
  }
}
