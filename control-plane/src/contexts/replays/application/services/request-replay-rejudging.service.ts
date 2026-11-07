import type { RecordReplayVerdict } from '@replays/application/services/record-replay-verdict.service';
import type { RequestChangeJudging } from '@replays/application/services/request-change-judging.service';
import type { ReplayRejudgingRequested } from '@replays/domain/events/replay-rejudging-requested.event';

export class RequestReplayRejudging {
  constructor(
    private readonly judgings: RequestChangeJudging,
    private readonly verdicts: RecordReplayVerdict,
  ) {}

  async requested(event: ReplayRejudgingRequested): Promise<void> {
    const ordered = await this.judgings.requeue(event.run);

    if (ordered !== 'requested') {
      await this.verdicts.rejudgingFailed(
        event.run,
        ordered === 'unavailable' ? 'unavailable' : 'errored',
        null,
      );
    }
  }
}
