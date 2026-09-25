import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

export class ForgetHosts {
  readonly name = 'Forgetting hosts nothing has heard from';

  constructor(
    private readonly hosts: RunnerHostRepository,
    private readonly clock: ClockPort,
  ) {}

  async servingThrough(way: RunnerPoolId | RunnerTrustId): Promise<void> {
    await this.hosts.removeThrough(Admission.through(way));
  }

  async unheard(): Promise<number> {
    return this.hosts.removeUnseenSince(
      RunnerHost.rememberedSince(this.clock.now()),
    );
  }
}
