import { reviseRunner } from '@runners/application/services/runner-revisions';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class RevokeTrustedRunners {
  constructor(
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
  ) {}

  async withdrawn(trustId: RunnerTrustId): Promise<void> {
    for (const each of await this.runners.underTrust(trustId)) {
      await reviseRunner(this.runners, each.id, (runner) =>
        runner.revoke(
          this.clock.now(),
          Attribution.spotlight(runner.workspaceId),
        ),
      );
    }
  }
}
