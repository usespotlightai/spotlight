import { Inject, Injectable } from '@nestjs/common';
import { StationWatch } from '@outcomes/domain/aggregates/station-watch.aggregate';
import { StationWatchVersionConflictError } from '@outcomes/domain/exceptions/station-watch-version-conflict.error';
import type { StationWatchRepository } from '@outcomes/domain/repositories/station-watch.repository';
import { AlertCrossing } from '@outcomes/domain/value-objects/alert-crossing.vo';
import { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import { AlertRule } from '@outcomes/domain/value-objects/alert-rule.vo';
import {
  stationAlert,
  stationWatch,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

type WatchRow = typeof stationWatch.$inferSelect;

type AlertRow = typeof stationAlert.$inferSelect;

const crossingOf = (row: AlertRow): AlertCrossing =>
  AlertCrossing.of({
    id: AlertId.of(row.id),
    rule: AlertRule.of({
      measure: row.measure,
      [row.threshold]: row.amount,
      over: row.over,
    }),
    reading: { value: row.value, baseline: row.baseline },
    runId: RunId.of(row.runId),
    taskId: TaskId.of(row.taskId),
    raisedAt: row.raisedAt,
    recoveredAt: row.recoveredAt,
    clearRuns: row.clearRuns,
    lastSeen: row.lastSeenRunId ? RunId.of(row.lastSeenRunId) : null,
  });

const toWatch = (row: WatchRow, alerts: readonly AlertRow[]): StationWatch =>
  StationWatch.rehydrate({
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
    },
    crossings: alerts.map(crossingOf),
    version: row.version,
  });

const alertRowOf = (watch: StationWatch, crossing: AlertCrossing) => ({
  id: crossing.id.value,
  stationId: watch.station.stationId,
  measure: crossing.rule.measure,
  threshold: crossing.rule.threshold,
  amount: crossing.rule.amount,
  over: crossing.rule.over,
  value: crossing.reading.value,
  baseline: crossing.reading.baseline,
  runId: crossing.runId.value,
  taskId: crossing.taskId.value,
  raisedAt: crossing.raisedAt,
  recoveredAt: crossing.recoveredAt,
  clearRuns: crossing.clearRuns,
  lastSeenRunId: crossing.lastSeen?.value ?? null,
});

@Injectable()
export class DrizzleStationWatchRepository implements StationWatchRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: StationWatch): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(stationWatch)
        .values({
          stationId: added.station.stationId,
          workspaceId: added.station.workspaceId.value,
          teamId: added.station.teamId.value,
          lineId: added.station.lineId,
          version: added.version,
        })
        .onConflictDoNothing()
        .returning({ stationId: stationWatch.stationId });

      if (written.length === 0) {
        throw new StationWatchVersionConflictError(added.station.stationId);
      }

      await this.writeAlerts(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: StationWatch): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(stationWatch)
        .set({ version: saved.version + 1, lineId: saved.station.lineId })
        .where(
          and(
            eq(stationWatch.stationId, saved.station.stationId),
            eq(stationWatch.version, saved.version),
          ),
        )
        .returning({ stationId: stationWatch.stationId });

      if (written.length === 0) {
        throw new StationWatchVersionConflictError(saved.station.stationId);
      }

      await this.writeAlerts(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  async of(stationId: string, withTask?: TaskId): Promise<StationWatch | null> {
    return this.watchAt(
      stationId,
      withTask ? eq(stationAlert.taskId, withTask.value) : null,
    );
  }

  async raising(alertId: AlertId): Promise<StationWatch | null> {
    const [row] = await this.context.db
      .select({ stationId: stationAlert.stationId })
      .from(stationAlert)
      .where(eq(stationAlert.id, alertId.value))
      .limit(1);

    return row
      ? this.watchAt(row.stationId, eq(stationAlert.id, alertId.value))
      : null;
  }

  async stationsWithTask(taskId: TaskId): Promise<readonly string[]> {
    const rows = await this.context.db
      .selectDistinct({ stationId: stationAlert.stationId })
      .from(stationAlert)
      .where(eq(stationAlert.taskId, taskId.value));

    return rows.map((each) => each.stationId);
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(stationWatch)
      .where(
        and(
          eq(stationWatch.workspaceId, workspaceId.value),
          eq(stationWatch.teamId, teamId.value),
        ),
      );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(stationWatch)
      .where(eq(stationWatch.workspaceId, workspaceId.value));
  }

  private async watchAt(
    stationId: string,
    alsoIncluded: SQL | null,
  ): Promise<StationWatch | null> {
    const [row] = await this.context.db
      .select()
      .from(stationWatch)
      .where(eq(stationWatch.stationId, stationId))
      .limit(1);

    if (!row) {
      return null;
    }

    const alerts = await this.context.db
      .select()
      .from(stationAlert)
      .where(
        and(
          eq(stationAlert.stationId, stationId),
          alsoIncluded
            ? or(isNull(stationAlert.recoveredAt), alsoIncluded)
            : isNull(stationAlert.recoveredAt),
        ),
      )
      .orderBy(asc(stationAlert.raisedAt), asc(stationAlert.id));
    const cooling = await this.context.db
      .selectDistinctOn([stationAlert.measure, stationAlert.threshold])
      .from(stationAlert)
      .where(
        and(
          eq(stationAlert.stationId, stationId),
          isNotNull(stationAlert.recoveredAt),
        ),
      )
      .orderBy(
        asc(stationAlert.measure),
        asc(stationAlert.threshold),
        desc(stationAlert.recoveredAt),
        desc(stationAlert.id),
      );
    const openIds = new Set(alerts.map((each) => each.id));

    return toWatch(row, [
      ...alerts,
      ...cooling.filter((each) => !openIds.has(each.id)),
    ]);
  }

  private async writeAlerts(watch: StationWatch): Promise<void> {
    if (watch.dropped.length > 0) {
      await this.context.db.delete(stationAlert).where(
        and(
          eq(stationAlert.stationId, watch.station.stationId),
          inArray(
            stationAlert.id,
            watch.dropped.map((each) => each.value),
          ),
        ),
      );
    }

    if (watch.changed.length === 0) {
      return;
    }

    await this.context.db
      .insert(stationAlert)
      .values(watch.changed.map((each) => alertRowOf(watch, each)))
      .onConflictDoUpdate({
        target: stationAlert.id,
        set: {
          amount: sql`excluded.amount`,
          over: sql`excluded.over`,
          value: sql`excluded.value`,
          baseline: sql`excluded.baseline`,
          recoveredAt: sql`excluded.recovered_at`,
          clearRuns: sql`excluded.clear_runs`,
          lastSeenRunId: sql`excluded.last_seen_run_id`,
        },
      });
  }
}
