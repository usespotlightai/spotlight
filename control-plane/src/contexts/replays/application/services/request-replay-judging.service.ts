import type { InsightsPort } from '@replays/application/ports/insights.port';
import type { RequestChangeJudging } from '@replays/application/services/request-change-judging.service';
import type { ReplayJudgingRequested } from '@replays/domain/events/replay-judging-requested.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { judgingRequestOf } from '@replays/domain/services/judging-request';
import { referenceFor } from '@replays/domain/services/reference-change';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class RequestReplayJudging {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly insights: InsightsPort,
    private readonly judgings: RequestChangeJudging,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async requested(event: ReplayJudgingRequested): Promise<void> {
    const judging = judgingRequestOf(
      await this.candidates.find(event.candidateId),
    );
    const ordered = judging.judged
      ? await this.judgings.request({
          run: event.run,
          workspaceId: event.workspaceId,
          teamId: judging.teamId,
          criteria: judging.criteria,
          reference: referenceFor(
            event.original,
            await this.insights.acceptedAfter(event.original),
          ),
        })
      : judging.failure;

    if (ordered === 'requested') {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const replay = await this.replays.find(event.replayId);
      const failed = replay?.recordJudgingFailure(
        event.run,
        ordered,
        null,
        this.clock.now(),
      );

      if (replay && failed && failed !== replay) {
        await this.replays.save(failed);
      }
    });
  }
}
