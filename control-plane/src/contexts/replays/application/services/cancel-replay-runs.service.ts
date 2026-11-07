import type { ReplayRunDispatching } from '@replays/application/services/replay-run-dispatch.service';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class CancelReplayRuns {
  constructor(private readonly replayRuns: ReplayRunDispatching) {}

  async stopped(runs: readonly RunId[]): Promise<void> {
    for (const run of runs) {
      await this.replayRuns.cancel(run, false);
    }
  }

  ceilingReached(runs: readonly RunId[]): Promise<void> {
    return this.replayRuns.cancelQueued(runs);
  }
}
