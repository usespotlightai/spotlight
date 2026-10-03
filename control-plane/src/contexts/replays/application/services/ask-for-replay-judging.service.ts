import type { OutcomesPort } from '@replays/application/ports/outcomes.port';
import type { ReplayJudgingWanted } from '@replays/domain/events/replay-judging-wanted.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { referenceFor } from '@replays/domain/services/reference-change';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class AskForReplayJudging {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly outcomes: OutcomesPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async wanted(event: ReplayJudgingWanted): Promise<void> {
    const candidate = await this.candidates.find(event.candidateId);
    const judge = candidate?.judge ?? null;
    const asked =
      candidate && judge
        ? await this.outcomes.judge({
            run: event.run,
            workspaceId: event.workspaceId,
            teamId: candidate.teamId,
            judge,
            reference: referenceFor(
              event.original,
              await this.outcomes.acceptedAfter(event.original),
            ),
          })
        : 'unreadable-rubric';

    if (asked === 'asked') {
      return;
    }

    await this.transaction.run(async () => {
      const replay = await this.replays.find(event.replayId);
      const refused = replay?.judgingFailed(
        event.run,
        asked,
        null,
        this.clock.now(),
      );

      if (replay && refused && refused !== replay) {
        await this.replays.save(refused);
      }
    });
  }
}
