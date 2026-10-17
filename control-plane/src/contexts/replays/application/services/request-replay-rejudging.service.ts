import type { OutcomesPort } from '@replays/application/ports/outcomes.port';
import { ReplayRejudgingFailed } from '@replays/domain/events/replay-rejudging-failed.event';
import type { ReplayRejudgingRequested } from '@replays/domain/events/replay-rejudging-requested.event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class RequestReplayRejudging {
  constructor(private readonly outcomes: OutcomesPort) {}

  async requested(
    event: ReplayRejudgingRequested,
  ): Promise<readonly DomainEvent[]> {
    const ordered = await this.outcomes.judgeAgain(event.run);

    return ordered === 'requested'
      ? []
      : [
          new ReplayRejudgingFailed(
            event.replayId,
            event.workspaceId,
            event.run,
            ordered === 'unavailable' ? 'unavailable' : 'errored',
          ),
        ];
  }
}
