import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

export class PruneStaleHosts {
  readonly name = 'Pruning stale hosts';

  constructor(
    private readonly hosts: RunnerHostRepository,
    private readonly clock: ClockPort,
  ) {}

  async servingThrough(way: RunnerPoolId | RunnerTrustId): Promise<void> {
    await this.hosts.removeThrough(Admission.through(way));
  }

  async pruneStale(): Promise<number> {
    return this.hosts.removeStaleBefore(
      RunnerHost.staleBefore(this.clock.now()),
    );
  }
}
