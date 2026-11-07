import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { scoresOf } from '@replays/domain/services/search-scores';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class HoldOutSearch {
  constructor(
    private readonly searches: SearchRepository,
    private readonly replays: ReplayRepository,
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

      const heldOutSearch = search.heldOutFrom(
        scoresOf(search, await this.replays.ofSearch(search.id), minGain),
        () => ReplayId.of(this.ids.generate()),
        this.clock.now(),
      );

      await this.searches.save(heldOutSearch);
    });
  }
}
