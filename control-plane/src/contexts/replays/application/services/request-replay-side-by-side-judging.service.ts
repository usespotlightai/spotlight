import type { RecordReplayPairVerdict } from '@replays/application/services/record-replay-pair-verdict.service';
import type { RequestSideBySideJudging } from '@replays/application/services/request-side-by-side-judging.service';
import { PAIR_ATTEMPTS } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySideBySideJudgingRequested } from '@replays/domain/events/replay-side-by-side-judging-requested.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';

export class RequestReplaySideBySideJudging {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly judgings: RequestSideBySideJudging,
    private readonly paired: RecordReplayPairVerdict,
  ) {}

  async requested(event: ReplaySideBySideJudgingRequested): Promise<void> {
    const replay = await this.replays.find(event.replayId);
    const candidate = await this.candidates.find(event.candidateId);
    const judge = candidate?.judge ?? null;
    const ordered =
      replay && judge
        ? await this.judgings.request({
            run: event.run,
            other: event.other,
            workspaceId: event.workspaceId,
            teamId: replay.teamId,
            criteria: judge,
            reference: event.original,
            maxAttempts: PAIR_ATTEMPTS,
          })
        : 'unreadable-rubric';

    if (ordered !== 'requested') {
      await this.paired.failed(event.run, event.other, ordered, null);
    }
  }
}
