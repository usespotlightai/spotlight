import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunDetached } from '@work/domain/events/run-detached.event';
import type { RunRepository } from '@work/domain/repositories/run.repository';

export class CancelDetachedRun {
  constructor(
    private readonly runs: RunRepository,
    private readonly clock: ClockPort,
  ) {}

  async on(event: RunDetached): Promise<void> {
    const run = await this.runs.findById(event.runId);
    const cancelled = run?.cancel(this.clock.now());

    if (run && cancelled && cancelled !== run) {
      await this.runs.save(cancelled);
    }
  }
}
