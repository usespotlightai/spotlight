import type { WorkPort } from '@replays/application/ports/work.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class CancelReplayRuns {
  constructor(private readonly work: WorkPort) {}

  async stopped(runs: readonly RunId[]): Promise<void> {
    for (const run of runs) {
      await this.work.cancel(run, false);
    }
  }

  ceilingReached(runs: readonly RunId[]): Promise<void> {
    return this.work.cancelQueued(runs);
  }
}
