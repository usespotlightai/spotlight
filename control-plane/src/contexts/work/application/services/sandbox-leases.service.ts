import type { SandboxesPort } from '@runners/application/ports/sandboxes.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class SandboxLeases {
  constructor(
    private readonly sandboxes: SandboxesPort,
    private readonly clock: ClockPort,
  ) {}

  runLeft(runId: RunId): Promise<void> {
    return this.sandboxes.releaseRun(runId.value, this.clock.now());
  }
}
