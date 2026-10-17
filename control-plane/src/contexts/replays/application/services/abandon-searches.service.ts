import type { WorkPort } from '@replays/application/ports/work.port';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { SearchAbandonmentDue } from '@replays/domain/events/search-abandonment-due.event';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class AbandonSearches {
  constructor(
    private readonly searches: SearchRepository,
    private readonly work: WorkPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async ofTeam(
    teamId: TeamId,
    workspaceId: WorkspaceId,
  ): Promise<readonly DomainEvent[]> {
    return (await this.searches.ofTeam(teamId)).map(
      (each) => new SearchAbandonmentDue(each.id, workspaceId),
    );
  }

  async search(id: SearchId): Promise<void> {
    const activeRun = await this.transaction.inTransaction(async () => {
      const search = await this.searches.locked(id);

      if (!search) {
        return null;
      }

      await this.searches.save(search.abandon());

      return search.activeRun;
    });

    if (activeRun) {
      await this.work.cancelSearchRun(activeRun);
    }
  }

  setGone(setId: ReplaySetId): Promise<void> {
    return this.endingOf(setId, (search, at) => search.recordSetGone(at));
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
