import type { SetHealths } from '@replays/application/services/set-healths.service';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

export class HoldOutSearch {
  constructor(
    private readonly searches: SearchRepository,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly sets: ReplaySetRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly healths: SetHealths,
  ) {}

  async requested(searchId: SearchId): Promise<void> {
    const seen = await this.searches.find(searchId);

    if (!seen?.wantsHoldingOut) {
      return;
    }

    const { minGain } = await this.healths.standardAt(seen.station);

    return this.transaction.inTransaction(async () => {
      const search = await this.searches.locked(searchId);

      if (!search?.wantsHoldingOut) {
        return;
      }

      const at = this.clock.now();
      const set = await this.sets.find(search.setId);

      if (!set) {
        await this.searches.save(search.recordSetGone(at));
        return;
      }

      const heldOutSearch = search.heldOutFrom(
        await this.replays.ofSearch(search.id),
        minGain,
        () => ReplayId.of(this.ids.generate()),
        at,
      );
      const candidates = await this.candidates.findMany(
        heldOutSearch.heldOut.map((each) => each.candidateId),
      );
      const starting = heldOutSearch.heldOut.map((each) => {
        const candidate = candidates.find((one) =>
          one.id.equals(each.candidateId),
        );

        if (!candidate) {
          throw new InconsistentStateError(
            'search',
            `${search.id.value} holds out candidate ${each.candidateId.value}, which is gone`,
          );
        }

        return { ...each, candidate };
      });

      for (const { replay, candidate } of starting) {
        await this.replays.add(
          Replay.start({
            id: replay.replayId,
            set,
            candidate,
            baseline: false,
            ceiling: search.ceilingSplit.heldOutReplay,
            unpricedRate: search.ceilingSplit.perRun,
            at,
            by: ChangeActor.spotlight(search.workspaceId),
            runSubset: search.split.heldOutRuns,
            repeats: search.budget.repeats,
            searchId: search.id,
            pairwiseReferenceId: search.seed.replay.replayId,
          }),
        );
      }

      await this.searches.save(heldOutSearch);
    });
  }
}
