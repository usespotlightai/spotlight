import type { WorkPort } from '@replays/application/ports/work.port';
import type { DispatchSearchIteration } from '@replays/application/services/dispatch-search-iteration.service';
import type { HoldOutSearch } from '@replays/application/services/hold-out-search.service';
import type { LetSearchGo } from '@replays/application/services/let-search-go.service';
import type { NoteSearchProgress } from '@replays/application/services/note-search-progress.service';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import {
  runsToSee,
  type SeenRun,
  unclaimedTooLong,
} from '@replays/domain/services/search-reconciliation';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { OwedWorkPort } from '@shared-kernel/application/ports/owed-work.port';

export class AdvanceSearches implements OwedWorkPort {
  readonly name = 'Advancing searches';

  constructor(
    private readonly searches: SearchRepository,
    private readonly replays: ReplayRepository,
    private readonly work: WorkPort,
    private readonly dispatching: DispatchSearchIteration,
    private readonly holdingOut: HoldOutSearch,
    private readonly noting: NoteSearchProgress,
    private readonly lettingGo: LetSearchGo,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async workDue(): Promise<void> {
    for (const search of await this.searches.advancing()) {
      await this.advance(search).catch((error: unknown) =>
        this.logger.warn(
          { err: error, searchId: search.id.value },
          'A search could not be advanced',
        ),
      );
    }
  }

  private async advance(search: Search): Promise<void> {
    await this.noting.reconcile(search, await this.runsOf(search));

    const fresh = await this.searches.find(search.id);

    if (!fresh) {
      return;
    }
    if (fresh.wantedIteration) {
      await this.dispatching.wanted(fresh.id);
    }
    if (fresh.wantsHoldingOut) {
      await this.holdingOut.wanted(fresh.id);
    }
    if (!fresh.isActive) {
      if (fresh.activeRun) {
        await this.work.withdrawSearch(fresh.activeRun);
      }
      await this.lettingGo.leftOver(
        fresh,
        await this.replays.ofSearch(fresh.id),
      );
    }
  }

  private async runsOf(search: Search): Promise<readonly SeenRun[]> {
    const runs = await this.work.searchRunStatuses(runsToSee(search));
    const at = this.clock.now();
    const overdue = search.isActive ? unclaimedTooLong(search, runs, at) : null;

    if (!overdue) {
      return runs;
    }

    const withdrawal = await this.work.withdrawUnclaimedSearch(overdue);

    return withdrawal.outcome === 'withdrawn'
      ? runs.map((each) =>
          each.run.equals(overdue)
            ? {
                ...each,
                phase: 'ended' as const,
                failed: true,
                started: withdrawal.started,
                endedAt: at,
              }
            : each,
        )
      : runs;
  }
}
