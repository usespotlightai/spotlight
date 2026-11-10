import type { RecordReplayPairVerdict } from '@replays/application/services/record-replay-pair-verdict.service';
import type { RequestSideBySideJudging } from '@replays/application/services/request-side-by-side-judging.service';
import type { ReplaySideBySideJudgingRequested } from '@replays/domain/events/replay-side-by-side-judging-requested.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { judgingRequestOf } from '@replays/domain/services/judging-request';

const PAIR_ATTEMPTS = 2;

export class RequestReplaySideBySideJudging {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly judgings: RequestSideBySideJudging,
    private readonly paired: RecordReplayPairVerdict,
  ) {}

  async requested(event: ReplaySideBySideJudgingRequested): Promise<void> {
    const replay = await this.replays.find(event.replayId);

    if (!replay) {
      return;
    }

    const judging = judgingRequestOf(
      await this.candidates.find(event.candidateId),
    );
    const ordered = judging.judged
      ? await this.judgings.request({
          run: event.run,
          other: event.other,
          workspaceId: event.workspaceId,
          teamId: replay.teamId,
          criteria: judging.criteria,
          reference: event.original,
          maxAttempts: PAIR_ATTEMPTS,
        })
      : judging.failure;

    if (ordered !== 'requested') {
      await this.paired.failed(event.run, event.other, ordered);
    }
  }
}
