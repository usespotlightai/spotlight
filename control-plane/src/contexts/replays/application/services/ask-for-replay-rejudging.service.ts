import type { OutcomesPort } from '@replays/application/ports/outcomes.port';
import { ReplayRejudgingRefused } from '@replays/domain/events/replay-rejudging-refused.event';
import type { ReplayRejudgingWanted } from '@replays/domain/events/replay-rejudging-wanted.event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class AskForReplayRejudging {
  constructor(private readonly outcomes: OutcomesPort) {}

  async wanted(event: ReplayRejudgingWanted): Promise<readonly DomainEvent[]> {
    const asked = await this.outcomes.judgeAgain(event.run);

    return asked === 'asked'
      ? []
      : [
          new ReplayRejudgingRefused(
            event.replayId,
            event.workspaceId,
            event.run,
            asked === 'unavailable' ? 'unavailable' : 'errored',
          ),
        ];
  }
}
