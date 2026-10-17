import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

export class PurgeStaleHosts {
  readonly name = 'Purging stale hosts';

  constructor(
    private readonly hosts: RunnerHostRepository,
    private readonly clock: ClockPort,
  ) {}

  async servingThrough(id: RunnerPoolId | RunnerTrustId): Promise<void> {
    await this.hosts.removeThrough(CredentialSource.ofId(id));
  }

  async purgeStale(): Promise<number> {
    return this.hosts.removeStaleBefore(
      RunnerHost.staleBefore(this.clock.now()),
    );
  }
}
