import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { SearchReplaysPlanned } from '@replays/domain/events/search-replays-planned.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

export class StartSearchReplays {
  constructor(
    private readonly searches: SearchRepository,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly sets: ReplaySetRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async planned(event: SearchReplaysPlanned): Promise<void> {
    for (const replayId of event.replayIds) {
      await this.start(event.searchId, replayId);
    }
  }

  private start(searchId: SearchId, replayId: ReplayId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      if (await this.replays.find(replayId)) {
        return;
      }

      const search = await this.searches.locked(searchId);
      const terms = search?.isActive ? search.plannedReplay(replayId) : null;

      if (
        !search ||
        !terms ||
        !search.unendedReplays.some((each) => each.equals(replayId))
      ) {
        return;
      }

      const set = await this.sets.locked(search.setId);
      const candidate = await this.candidates.find(terms.candidateId);

      if (!set) {
        return;
      }
      if (!candidate) {
        throw new InconsistentStateError(
          'search',
          `${search.id.value} replays candidate ${terms.candidateId.value}, which is gone`,
        );
      }

      await this.replays.add(
        Replay.start({
          id: replayId,
          set: set.snapshot,
          candidate: candidate.asReplayed,
          baseline: terms.baseline,
          ceiling: terms.ceiling,
          unpricedRate: terms.unpricedRate,
          repeats: terms.repeats,
          calibration: terms.calibration,
          ...(terms.runSubset ? { runSubset: terms.runSubset } : {}),
          pairwiseReferenceId: terms.pairwiseReferenceId,
          searchId: search.id,
          at: this.clock.now(),
          by: ChangeActor.spotlight(search.workspaceId),
        }),
      );
    });
  }
}
