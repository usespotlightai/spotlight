import type { SandboxesPort } from '@runners/application/ports/sandboxes.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunRepository } from '@work/domain/repositories/run.repository';

export class SandboxLeases {
  constructor(
    private readonly sandboxes: SandboxesPort,
    private readonly runs: RunRepository,
    private readonly clock: ClockPort,
  ) {}

  runLeft(runId: RunId): Promise<void> {
    return this.sandboxes.releaseRun(runId.value, this.clock.now());
  }

  async runEnded(runId: RunId): Promise<void> {
    const run = await this.runs.findById(runId);

    return run?.sandboxIsRejoinable
      ? this.sandboxes.releaseRun(runId.value, this.clock.now())
      : this.sandboxes.retireRun(runId.value, this.clock.now());
  }
}
