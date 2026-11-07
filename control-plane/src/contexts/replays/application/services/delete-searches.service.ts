import type { WorkPort } from '@replays/application/ports/work.port';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { SearchDeleted } from '@replays/domain/events/search-deleted.event';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteSearches {
  constructor(
    private readonly searches: SearchRepository,
    private readonly work: WorkPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<void> {
    for (const search of await this.searches.ofTeam(teamId)) {
      await this.transaction.inTransaction(() =>
        this.searches.save(search.delete()),
      );
    }
  }

  async cancelRunOf(event: SearchDeleted): Promise<void> {
    if (event.runToCancel) {
      await this.work.cancelSearchRun(event.runToCancel);
    }
  }

  stationGone(setId: ReplaySetId): Promise<void> {
    return this.endingOf(setId, (search, at) => search.stationLeft(at));
  }

  private async endingOf(
    setId: ReplaySetId,
    ending: (search: Search, at: Date) => Search,
  ): Promise<void> {
    const seen = await this.searches.activeOfSet(setId);

    if (!seen) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const search = await this.searches.locked(seen.id);

      if (!search) {
        return;
      }

      const ended = ending(search, this.clock.now());

      if (ended !== search) {
        await this.searches.save(ended);
      }
    });
  }
}
