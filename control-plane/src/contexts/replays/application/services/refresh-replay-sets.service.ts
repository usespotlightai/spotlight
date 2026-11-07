import type { InsightsPort } from '@replays/application/ports/insights.port';
import type { TrialableRunsPort } from '@replays/application/ports/trialable-runs.port';
import type { SetUsage } from '@replays/application/services/set-usage.service';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplaySetInUseError } from '@replays/domain/exceptions/replay-set-in-use.error';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { tasksWithTaskCause } from '@replays/domain/services/reflected-tasks';
import {
  isDueForRefresh,
  REPLAY_SET_PICKED_FROM,
  type RefreshCutoff,
  refreshCutoff,
  refreshOf,
} from '@replays/domain/services/replay-set-refresh';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

const DUE_PER_TICK = 20;

export class RefreshReplaySets implements PendingJobsPort {
  readonly name = 'RefreshReplaySets';

  constructor(
    private readonly sets: ReplaySetRepository,
    private readonly searches: SearchRepository,
    private readonly usage: SetUsage,
    private readonly trialableRuns: TrialableRunsPort,
    private readonly insights: InsightsPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    const cutoff = refreshCutoff(this.clock.now());

    for (const set of await this.dueSets(cutoff)) {
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

  private async dueSets(cutoff: RefreshCutoff): Promise<readonly ReplaySet[]> {
    const due: ReplaySet[] = [];

    for (const set of await this.sets.atLiveStationsRefreshedBefore(
      cutoff.unfilledBefore,
    )) {
      if (due.length === DUE_PER_TICK) {
        break;
      }
      if (
        isDueForRefresh(set, cutoff) &&
        !(await this.usage.of(set.id)).inUse
      ) {
        due.push(set);
      }
    }

    return due;
  }

  refreshBefore(setId: ReplaySetId): Promise<boolean> {
    return this.refresh(setId, null);
  }

  private async refresh(
    setId: ReplaySetId,
    due: RefreshCutoff | null,
  ): Promise<boolean> {
    const seen = await this.sets.find(setId);

    if (!seen || seen.isAtGoneStation || (await this.usage.of(seen.id)).inUse) {
      return false;
    }

    const recent = await this.trialableRuns.recentAt(
      seen.workspaceId,
      seen.station.stationId,
      REPLAY_SET_PICKED_FROM,
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
            await this.usage.of(set.id),
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
