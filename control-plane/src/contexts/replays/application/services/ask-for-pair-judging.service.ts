import type { OutcomesPort } from '@replays/application/ports/outcomes.port';
import { PAIR_ATTEMPTS } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayPairJudgingWanted } from '@replays/domain/events/replay-pair-judging-wanted.event';
import { ReplayPairingFailed } from '@replays/domain/events/replay-pairing-failed.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class AskForPairJudging {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly outcomes: OutcomesPort,
  ) {}

  async wanted(
    event: ReplayPairJudgingWanted,
  ): Promise<readonly DomainEvent[]> {
    const replay = await this.replays.find(event.replayId);
    const candidate = await this.candidates.find(event.candidateId);
    const judge = candidate?.judge ?? null;
    const asked =
      replay && judge
        ? await this.outcomes.judgePair({
            run: event.run,
            against: event.against,
            workspaceId: event.workspaceId,
            teamId: replay.teamId,
            judge,
            reference: event.original,
            maxAttempts: PAIR_ATTEMPTS,
          })
        : 'unreadable-rubric';

    return asked === 'asked'
      ? []
      : [
          new ReplayPairingFailed(
            event.replayId,
            event.workspaceId,
            event.run,
            event.against,
            asked,
          ),
        ];
  }
}
