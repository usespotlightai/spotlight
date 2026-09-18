import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import type { RunRepository } from '@work/domain/repositories/run.repository';

const LET_GO = 'Its task moved on before a runner took it up.';

export class StopLetGoRun {
  constructor(
    private readonly runs: RunRepository,
    private readonly clock: ClockPort,
  ) {}

  async on(event: TaskLetGoOfRun): Promise<void> {
    const run = await this.runs.findById(event.runId);

    if (run?.state === 'queued') {
      await this.runs.save(run.withdrawn(LET_GO));
      return;
    }

    if (run?.state === 'claimed') {
      await this.runs.save(run.requestStop(this.clock.now()));
    }
  }
}
