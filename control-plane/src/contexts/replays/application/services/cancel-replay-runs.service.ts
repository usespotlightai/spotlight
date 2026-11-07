import type { ReplayRunDispatching } from '@replays/application/services/replay-run-dispatch.service';
import type { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class CancelReplayRuns {
  constructor(private readonly replayRuns: ReplayRunDispatching) {}

  async stopped(event: ReplayStopped): Promise<void> {
    const owner = {
      workspaceId: event.workspaceId,
      teamId: event.teamId,
      replayId: event.replayId,
    };

    for (const run of event.runs) {
      await this.replayRuns.cancel(run, owner, false);
    }
  }

  ceilingReached(runs: readonly RunId[]): Promise<void> {
    return this.replayRuns.cancelQueued(runs);
  }
}
