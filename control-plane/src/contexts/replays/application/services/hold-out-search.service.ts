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
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

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

  async wanted(searchId: SearchId): Promise<void> {
    const seen = await this.searches.find(searchId);

    if (!seen?.wantsHoldingOut) {
      return;
    }

    const { minGain } = await this.healths.standardAt(seen.station);

    return this.transaction.run(async () => {
      const search = await this.searches.locked(searchId);

      if (!search?.wantsHoldingOut) {
        return;
      }

      const at = this.clock.now();
      const set = await this.sets.find(search.setId);

      if (!set) {
        await this.searches.save(search.setGone(at));
        return;
      }

      const held = search.heldOutFrom(
        await this.replays.ofSearch(search.id),
        minGain,
        () => ReplayId.of(this.ids.generate()),
        at,
      );
      const candidates = await this.candidates.findMany(
        held.heldOut.map((each) => each.candidateId),
      );
      const starting = held.heldOut.map((each) => {
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
          Replay.started({
            id: replay.replayId,
            set,
            candidate,
            baseline: false,
            ceiling: search.allotment.heldOutReplay,
            unpricedRate: search.allotment.perRun,
            at,
            by: Attribution.spotlight(search.workspaceId),
            among: search.split.heldOutRuns,
            repeats: search.budget.repeats,
            searchId: search.id,
          }),
        );
      }

      await this.searches.save(held);
    });
  }
}
