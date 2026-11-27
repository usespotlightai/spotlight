import type { LiveCandidates } from '@replays/application/services/live-candidates.service';
import {
  PENDING_STEP_LEASE_MS,
  type PendingSearchStep,
  type SearchStepKey,
  type StationSearchSchedule,
} from '@replays/domain/aggregates/station-search-schedule.aggregate';
import type { LineSearchBudgetRepository } from '@replays/domain/repositories/line-search-budget.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { StationSearchScheduleRepository } from '@replays/domain/repositories/station-search-schedule.repository';
import { monthStartOf } from '@replays/domain/services/search-schedule';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

const STATIONS_PER_TICK = 20;

export class PendingSearchSteps implements PendingJobsPort {
  readonly name = 'PendingSearchSteps';

  constructor(
    private readonly schedules: StationSearchScheduleRepository,
    private readonly searches: SearchRepository,
    private readonly budgets: LineSearchBudgetRepository,
    private readonly snapshots: LiveCandidates,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    const before = new Date(this.clock.now().getTime() - PENDING_STEP_LEASE_MS);

    for (const stationId of await this.schedules.withStepsPendingSince(
      before,
      STATIONS_PER_TICK,
    )) {
      try {
        await this.resolvedAt(stationId, before);
      } catch (error) {
        this.logger.warn(
          { stationId: stationId.value, error },
          'A pending search start or join could not be resolved. Spotlight tries again later.',
        );
      }
    }
  }

  async confirmed(stationId: StationId, key: SearchStepKey): Promise<void> {
    try {
      await this.changed(stationId, (schedule) => schedule.stepConfirmed(key));
    } catch (error) {
      this.left(key, error);
    }
  }

  async abandoned(
    stationId: StationId,
    key: SearchStepKey,
    candidates: readonly CandidateId[],
  ): Promise<void> {
    try {
      await this.withdrawn(stationId, key, candidates);
    } catch (error) {
      this.left(key, error);
    }
  }

  async admissionWithdrawn(
    lineId: LineId,
    searchId: SearchId,
    at: Date,
  ): Promise<void> {
    try {
      await this.transaction.inTransaction(async () => {
        const budget = await this.budgets.locked(lineId, monthStartOf(at));

        if (budget?.admits(searchId)) {
          await this.budgets.save(budget.withdrawn(searchId));
        }
      });
    } catch (error) {
      this.logger.warn(
        { searchId: searchId.value, error },
        'An unused search admission could not be withdrawn; its lease ends on its own.',
      );
    }
  }

  private async resolvedAt(stationId: StationId, before: Date): Promise<void> {
    const schedule = await this.schedules.ofStation(stationId);

    for (const step of schedule?.pendingSteps ?? []) {
      if (step.at > before) {
        continue;
      }
      if (await this.isTaken(step)) {
        await this.changed(stationId, (each) => each.stepConfirmed(step));
        continue;
      }

      await this.withdrawn(stationId, step, step.candidates);

      if (schedule && step.kind === 'start') {
        await this.admissionWithdrawn(
          schedule.station.lineId,
          step.searchId,
          step.at,
        );
      }
    }
  }

  private async isTaken(step: PendingSearchStep): Promise<boolean> {
    const search = await this.searches.find(step.searchId);

    return step.kind === 'start' || step.request === null
      ? search !== null
      : (search?.holdsRequest(step.request) ?? false);
  }

  private async withdrawn(
    stationId: StationId,
    key: SearchStepKey,
    candidates: readonly CandidateId[],
  ): Promise<void> {
    for (const each of candidates) {
      await this.snapshots.released(each);
    }
    await this.changed(stationId, (schedule) => schedule.stepWithdrawn(key));
  }

  private changed(
    stationId: StationId,
    change: (schedule: StationSearchSchedule) => StationSearchSchedule,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const schedule = await this.schedules.locked(stationId);

      if (!schedule) {
        return;
      }

      const next = change(schedule);

      if (next !== schedule) {
        await this.schedules.save(next);
      }
    });
  }

  private left(key: SearchStepKey, error: unknown): void {
    this.logger.warn(
      { searchId: key.searchId.value, error },
      'A search start or join could not be settled on its schedule yet. Spotlight tries again later.',
    );
  }
}
