import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import type { ReplayRecheckRequested } from '@replays/domain/events/replay-recheck-requested.event';
import { ReplayRecheckUnavailable } from '@replays/domain/events/replay-recheck-unavailable.event';
import { ReplayStackRecheckRequested } from '@replays/domain/events/replay-stack-recheck-requested.event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class RequestReplayRecheck {
  constructor(private readonly changes: ChangeReviewPort) {}

  async requested(
    event: ReplayRecheckRequested,
  ): Promise<readonly DomainEvent[]> {
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
            new ReplayStackRecheckRequested(
              event.replayId,
              event.workspaceId,
              event.run,
              stackId,
            ),
        );
  }

  stack(event: ReplayStackRecheckRequested): Promise<void> {
    return this.changes.recheck(event.run, event.stackId);
  }
}
