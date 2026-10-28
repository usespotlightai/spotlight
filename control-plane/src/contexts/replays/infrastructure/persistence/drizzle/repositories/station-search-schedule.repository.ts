import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import { StationSearchScheduleVersionConflictError } from '@replays/domain/exceptions/station-search-schedule-version-conflict.error';
import type { StationSearchScheduleRepository } from '@replays/domain/repositories/station-search-schedule.repository';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { stationSearchSchedule } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, lte, type SQL } from 'drizzle-orm';

type ScheduleRow = typeof stationSearchSchedule.$inferSelect;

const toSchedule = (row: ScheduleRow): StationSearchSchedule =>
  StationSearchSchedule.rehydrate({
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
    },
    setId: ReplaySetId.of(row.setId),
    lastStartedAt: row.lastStartedAt,
    lastSkip:
      row.lastSkipReason && row.lastSkipAt
        ? { reason: row.lastSkipReason, at: row.lastSkipAt }
        : null,
    searchedTasks: row.searchedTasks.map((each) => TaskId.of(each)),
    alertPendingSince: row.alertPendingSince,
    rejected: row.rejected.map((each) => StationFingerprint.of(each)),
    rejectedAgainst:
      row.rejectedAgainst === null
        ? null
        : StationFingerprint.of(row.rejectedAgainst),
    lastRejectedAt: row.lastRejectedAt,
    lastImprovedAt: row.lastImprovedAt,
    checkAfter: row.checkAfter,
    version: row.version,
  });

const columnsOf = (schedule: StationSearchSchedule) => ({
  workspaceId: schedule.workspaceId.value,
  teamId: schedule.teamId.value,
  lineId: schedule.station.lineId,
  setId: schedule.setId.value,
  lastStartedAt: schedule.lastStartedAt,
  lastSkipReason: schedule.lastSkip?.reason ?? null,
  lastSkipAt: schedule.lastSkip?.at ?? null,
  searchedTasks: schedule.searchedTasks.map((each) => each.value),
  alertPendingSince: schedule.alertPendingSince,
  rejected: schedule.rejected.map((each) => each.value),
  rejectedAgainst: schedule.rejectedAgainst?.value ?? null,
  lastRejectedAt: schedule.lastRejectedAt,
  lastImprovedAt: schedule.lastImprovedAt,
  checkAfter: schedule.checkAfter,
});

@Injectable()
export class DrizzleStationSearchScheduleRepository
  implements StationSearchScheduleRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async ofStation(stationId: string): Promise<StationSearchSchedule | null> {
    const [found] = await this.where(
      eq(stationSearchSchedule.stationId, stationId),
    );

    return found ?? null;
  }

  async locked(stationId: string): Promise<StationSearchSchedule | null> {
    const [found] = await this.where(
      eq(stationSearchSchedule.stationId, stationId),
      true,
    );

    return found ?? null;
  }

  async ofSet(setId: ReplaySetId): Promise<StationSearchSchedule | null> {
    const [found] = await this.where(
      eq(stationSearchSchedule.setId, setId.value),
    );

    return found ?? null;
  }

  async dueStations(now: Date, limit: number): Promise<readonly string[]> {
    return (
      await this.context.db
        .select({ stationId: stationSearchSchedule.stationId })
        .from(stationSearchSchedule)
        .where(lte(stationSearchSchedule.checkAfter, now))
        .orderBy(
          asc(stationSearchSchedule.checkAfter),
          asc(stationSearchSchedule.stationId),
        )
        .limit(limit)
    ).map((each) => each.stationId);
  }

  ofLine(lineId: string): Promise<readonly StationSearchSchedule[]> {
    return this.where(eq(stationSearchSchedule.lineId, lineId));
  }

  ofTeam(teamId: TeamId): Promise<readonly StationSearchSchedule[]> {
    return this.where(eq(stationSearchSchedule.teamId, teamId.value));
  }

  async add(added: StationSearchSchedule): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .insert(stationSearchSchedule)
        .values({
          stationId: added.stationId,
          ...columnsOf(added),
          version: added.version,
        })
        .onConflictDoNothing({ target: stationSearchSchedule.stationId });
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: StationSearchSchedule): Promise<void> {
    await this.context.inTransaction(async () => {
      const at = and(
        eq(stationSearchSchedule.stationId, saved.stationId),
        eq(stationSearchSchedule.version, saved.version),
      );
      const written = saved.isDeleted
        ? await this.context.db
            .delete(stationSearchSchedule)
            .where(at)
            .returning({ stationId: stationSearchSchedule.stationId })
        : await this.context.db
            .update(stationSearchSchedule)
            .set({ ...columnsOf(saved), version: saved.version + 1 })
            .where(at)
            .returning({ stationId: stationSearchSchedule.stationId });

      if (written.length === 0) {
        throw new StationSearchScheduleVersionConflictError(saved.stationId);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async where(
    where: SQL | undefined,
    locked = false,
  ): Promise<readonly StationSearchSchedule[]> {
    const query = this.context.db
      .select()
      .from(stationSearchSchedule)
      .where(where)
      .orderBy(asc(stationSearchSchedule.stationId));

    return (locked ? await query.for('update') : await query).map(toSchedule);
  }
}
