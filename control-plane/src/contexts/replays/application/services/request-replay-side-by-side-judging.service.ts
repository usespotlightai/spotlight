import type { InsightsPort } from '@replays/application/ports/insights.port';
import { PAIR_ATTEMPTS } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayPairingFailed } from '@replays/domain/events/replay-pairing-failed.event';
import type { ReplaySideBySideJudgingRequested } from '@replays/domain/events/replay-side-by-side-judging-requested.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class RequestReplaySideBySideJudging {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly insights: InsightsPort,
  ) {}

  async requested(
    event: ReplaySideBySideJudgingRequested,
  ): Promise<readonly DomainEvent[]> {
    const replay = await this.replays.find(event.replayId);
    const candidate = await this.candidates.find(event.candidateId);
    const judge = candidate?.judge ?? null;
    const ordered =
      replay && judge
        ? await this.insights.judgeSideBySide({
            run: event.run,
            other: event.other,
            workspaceId: event.workspaceId,
            teamId: replay.teamId,
            judge,
            reference: event.original,
            maxAttempts: PAIR_ATTEMPTS,
          })
        : 'unreadable-rubric';

    return ordered === 'requested'
      ? []
      : [
          new ReplayPairingFailed(
            event.replayId,
            event.workspaceId,
            event.run,
            event.other,
            ordered,
          ),
        ];
  }
}
