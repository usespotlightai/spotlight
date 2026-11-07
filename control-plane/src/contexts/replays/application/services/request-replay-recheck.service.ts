import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import type { RecordReplayChangeReview } from '@replays/application/services/record-replay-change-review.service';
import type { ReplayRecheckRequested } from '@replays/domain/events/replay-recheck-requested.event';

export class RequestReplayRecheck {
  constructor(
    private readonly changes: ChangeReviewPort,
    private readonly reviewing: RecordReplayChangeReview,
  ) {}

  async requested(event: ReplayRecheckRequested): Promise<void> {
    const stacks = await this.changes.recheckable(event.run);

    if (stacks.length === 0) {
      await this.reviewing.recheckUnavailable(event.replayId, event.run);
      return;
    }

    for (const stackId of stacks) {
      await this.changes.recheck(event.run, stackId);
    }
  }
}
