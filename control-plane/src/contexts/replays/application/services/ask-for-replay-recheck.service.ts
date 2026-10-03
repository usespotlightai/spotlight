import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import { ReplayRecheckUnavailable } from '@replays/domain/events/replay-recheck-unavailable.event';
import type { ReplayRecheckWanted } from '@replays/domain/events/replay-recheck-wanted.event';
import { ReplayStackRecheckWanted } from '@replays/domain/events/replay-stack-recheck-wanted.event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class AskForReplayRecheck {
  constructor(private readonly changes: ChangeReviewPort) {}

  async wanted(event: ReplayRecheckWanted): Promise<readonly DomainEvent[]> {
    const stacks = await this.changes.recheckable(event.run);

    return stacks.length === 0
      ? [
          new ReplayRecheckUnavailable(
            event.replayId,
            event.workspaceId,
            event.run,
          ),
        ]
      : stacks.map(
          (stackId) =>
            new ReplayStackRecheckWanted(
              event.replayId,
              event.workspaceId,
              event.run,
              stackId,
            ),
        );
  }

  stack(event: ReplayStackRecheckWanted): Promise<void> {
    return this.changes.recheck(event.run, event.stackId);
  }
}
