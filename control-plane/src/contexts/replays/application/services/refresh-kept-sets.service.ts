import type { InsightsPort } from '@replays/application/ports/insights.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { SetUsage } from '@replays/application/services/set-usage.service';
import { ReplaySetInUseError } from '@replays/domain/exceptions/replay-set-in-use.error';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import {
  isDueForRefresh,
  KEPT_SET_PICKED_FROM,
  type RefreshCutoff,
  refreshCutoff,
  refreshOf,
} from '@replays/domain/services/kept-set-refresh';
import { tasksWithTaskCause } from '@replays/domain/services/reflected-tasks';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

const DUE_PER_TICK = 20;

export class RefreshKeptSets implements PendingJobsPort {
  readonly name = 'RefreshKeptSets';

  constructor(
    private readonly sets: ReplaySetRepository,
    private readonly searches: SearchRepository,
    private readonly usage: SetUsage,
    private readonly work: WorkPort,
    private readonly insights: InsightsPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    const cutoff = refreshCutoff(this.clock.now());

    for (const set of await this.sets.dueForRefresh(cutoff, DUE_PER_TICK)) {
      try {
        await this.refresh(set.id, cutoff);
      } catch (error) {
        this.logger.warn(
          { setId: set.id.value, error },
          'A replay set could not be refreshed. Spotlight tries again later.',
        );
      }
    }
  }

  refreshBefore(setId: ReplaySetId): Promise<boolean> {
    return this.refresh(setId, null);
  }

  private async refresh(
    setId: ReplaySetId,
    due: RefreshCutoff | null,
  ): Promise<boolean> {
    const seen = await this.sets.find(setId);

    if (!seen || seen.isAtGoneStation || (await this.usage.inUse(seen.id))) {
      return false;
    }

    const recent = await this.work.recentAt(
      seen.workspaceId,
      seen.station.stationId,
      KEPT_SET_PICKED_FROM,
    );
    const outcomes = await this.insights.originalOutcomes([
      ...seen.runs,
      ...recent.map((each) => each.runId),
    ]);
    const taskCaused = tasksWithTaskCause(
      await this.searches.ofStation(seen.station.stationId),
    );

    try {
      return await this.transaction.inTransaction(async () => {
        const set = await this.sets.locked(setId);

        if (
          !set ||
          set.isAtGoneStation ||
          (due !== null && !isDueForRefresh(set, due))
        ) {
          return false;
        }

        const at = this.clock.now();

        await this.sets.save(
          set.refresh(
            refreshOf(set, recent, outcomes, at, taskCaused),
            at,
            await this.usage.inUse(set.id),
          ),
        );

        return true;
      });
    } catch (error) {
      if (error instanceof ReplaySetInUseError) {
        return false;
      }
      throw error;
    }
  }
}
