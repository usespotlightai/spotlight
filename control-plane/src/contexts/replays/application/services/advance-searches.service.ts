import type { WorkPort } from '@replays/application/ports/work.port';
import type { CancelSearch } from '@replays/application/services/cancel-search.service';
import type { DispatchSearchIteration } from '@replays/application/services/dispatch-search-iteration.service';
import type { HoldOutSearch } from '@replays/application/services/hold-out-search.service';
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
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';

export class AdvanceSearches implements PendingJobsPort {
  readonly name = 'Advancing searches';

  constructor(
    private readonly searches: SearchRepository,
    private readonly replays: ReplayRepository,
    private readonly work: WorkPort,
    private readonly dispatching: DispatchSearchIteration,
    private readonly holdingOut: HoldOutSearch,
    private readonly noting: NoteSearchProgress,
    private readonly cancellingSearches: CancelSearch,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
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
      await this.dispatching.requested(fresh.id);
    }
    if (fresh.wantsHoldingOut) {
      await this.holdingOut.requested(fresh.id);
    }
    if (!fresh.isActive) {
      if (fresh.activeRun) {
        await this.work.cancelSearchRun(fresh.activeRun);
      }
      await this.cancellingSearches.leftOver(
        fresh,
        await this.replays.ofSearch(fresh.id),
      );
    }
  }

  private async runsOf(search: Search): Promise<readonly SeenRun[]> {
    const runs = await this.work.searchRunStatuses(runsToSee(search));
    const at = this.clock.now();
    const unclaimed = search.isActive
      ? unclaimedTooLong(search, runs, at)
      : null;

    if (!unclaimed) {
      return runs;
    }

    const cancellation = await this.work.cancelUnclaimedSearchRun(unclaimed);

    return cancellation.outcome === 'cancelled'
      ? runs.map((each) =>
          each.run.equals(unclaimed)
            ? {
                ...each,
                phase: 'ended' as const,
                failed: true,
                started: cancellation.started,
                endedAt: at,
              }
            : each,
        )
      : runs;
  }
}
