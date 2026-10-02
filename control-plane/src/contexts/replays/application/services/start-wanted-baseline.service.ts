import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayBaselineWanted } from '@replays/domain/events/replay-baseline-wanted.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { needsBaseline } from '@replays/domain/services/baseline';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class StartWantedBaseline {
  constructor(
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  wanted(event: ReplayBaselineWanted): Promise<void> {
    return this.transaction.run(async () => {
      if (await this.replays.find(event.baselineId)) {
        return;
      }

      const set = await this.sets.locked(event.setId);
      const candidate = await this.candidates.find(event.candidateId);

      if (!candidate) {
        return;
      }

      if (
        !set ||
        set.isAtGoneStation ||
        !needsBaseline(
          set,
          await this.replays.ofSet(set.id),
          candidate.scoringDigest,
        )
      ) {
        await this.candidates.save(candidate.abandoned());
        return;
      }

      await this.replays.add(
        Replay.started({
          id: event.baselineId,
          set,
          candidate,
          baseline: true,
          ceiling: event.ceiling,
          ...(event.unpricedRate ? { unpricedRate: event.unpricedRate } : {}),
          at: this.clock.now(),
          by: Attribution.spotlight(set.workspaceId),
        }),
      );
    });
  }
}
