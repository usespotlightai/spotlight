import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import type { RunRepository } from '@work/domain/repositories/run.repository';

export class StopLetGoRun {
  constructor(
    private readonly runs: RunRepository,
    private readonly clock: ClockPort,
  ) {}

  async on(event: TaskLetGoOfRun): Promise<void> {
    const run = await this.runs.findById(event.runId);
    const letGo = run?.letGo(this.clock.now());

    if (run && letGo && letGo !== run) {
      await this.runs.save(letGo);
    }
  }
}
