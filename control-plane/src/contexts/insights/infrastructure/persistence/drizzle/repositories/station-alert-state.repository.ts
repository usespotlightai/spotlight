import { StationAlertState } from '@insights/domain/aggregates/station-alert-state.aggregate';
import { StationAlertStateVersionConflictError } from '@insights/domain/exceptions/station-alert-state-version-conflict.error';
import type { StationAlertStateRepository } from '@insights/domain/repositories/station-alert-state.repository';
import { AlertFiring } from '@insights/domain/value-objects/alert-firing.vo';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import {
  stationAlert,
  stationAlertState,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Inject, Injectable } from '@nestjs/common';
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

type AlertStateRow = typeof stationAlertState.$inferSelect;

type AlertRow = typeof stationAlert.$inferSelect;

const firingOf = (row: AlertRow): AlertFiring =>
  AlertFiring.of({
    id: AlertId.of(row.id),
    rule: AlertRule.of({
      measure: row.measure,
      [row.condition]: row.threshold,
      over: row.over,
    }),
    reading: { value: row.value, baseline: row.baseline },
    runId: RunId.of(row.runId),
    taskId: TaskId.of(row.taskId),
    firedAt: row.firedAt,
    resolvedAt: row.resolvedAt,
    clearRuns: row.clearRuns,
    lastSeen: row.lastSeenRunId ? RunId.of(row.lastSeenRunId) : null,
  });

const toAlertState = (
  row: AlertStateRow,
  alerts: readonly AlertRow[],
): StationAlertState =>
  StationAlertState.rehydrate({
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
    },
    firings: alerts.map(firingOf),
    version: row.version,
  });

const alertRowOf = (alertState: StationAlertState, firing: AlertFiring) => ({
  id: firing.id.value,
  stationId: alertState.station.stationId,
  measure: firing.rule.measure,
  condition: firing.rule.condition,
  threshold: firing.rule.threshold,
  over: firing.rule.over,
  value: firing.reading.value,
  baseline: firing.reading.baseline,
  runId: firing.runId.value,
  taskId: firing.taskId.value,
  firedAt: firing.firedAt,
  resolvedAt: firing.resolvedAt,
  clearRuns: firing.clearRuns,
  lastSeenRunId: firing.lastSeen?.value ?? null,
});

@Injectable()
export class DrizzleStationAlertStateRepository
  implements StationAlertStateRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: StationAlertState): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(stationAlertState)
        .values({
          stationId: added.station.stationId,
          workspaceId: added.station.workspaceId.value,
          teamId: added.station.teamId.value,
          lineId: added.station.lineId,
          version: added.version,
        })
        .onConflictDoNothing()
        .returning({ stationId: stationAlertState.stationId });

      if (written.length === 0) {
        throw new StationAlertStateVersionConflictError(
          added.station.stationId,
        );
      }

      await this.writeAlerts(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: StationAlertState): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(stationAlertState)
        .set({ version: saved.version + 1, lineId: saved.station.lineId })
        .where(
          and(
            eq(stationAlertState.stationId, saved.station.stationId),
            eq(stationAlertState.version, saved.version),
          ),
        )
        .returning({ stationId: stationAlertState.stationId });

      if (written.length === 0) {
        throw new StationAlertStateVersionConflictError(
          saved.station.stationId,
        );
      }

      await this.writeAlerts(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  async of(
    stationId: string,
    withTask?: TaskId,
  ): Promise<StationAlertState | null> {
    return this.alertStateAt(
      stationId,
      withTask ? eq(stationAlert.taskId, withTask.value) : null,
    );
  }

  async ofAlert(alertId: AlertId): Promise<StationAlertState | null> {
    const [row] = await this.context.db
      .select({ stationId: stationAlert.stationId })
      .from(stationAlert)
      .where(eq(stationAlert.id, alertId.value))
      .limit(1);

    return row
      ? this.alertStateAt(row.stationId, eq(stationAlert.id, alertId.value))
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
      .delete(stationAlertState)
      .where(
        and(
          eq(stationAlertState.workspaceId, workspaceId.value),
          eq(stationAlertState.teamId, teamId.value),
        ),
      );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(stationAlertState)
      .where(eq(stationAlertState.workspaceId, workspaceId.value));
  }

  private async alertStateAt(
    stationId: string,
    alsoIncluded: SQL | null,
  ): Promise<StationAlertState | null> {
    const [row] = await this.context.db
      .select()
      .from(stationAlertState)
      .where(eq(stationAlertState.stationId, stationId))
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
            ? or(isNull(stationAlert.resolvedAt), alsoIncluded)
            : isNull(stationAlert.resolvedAt),
        ),
      )
      .orderBy(asc(stationAlert.firedAt), asc(stationAlert.id));
    const cooling = await this.context.db
      .selectDistinctOn([stationAlert.measure, stationAlert.condition])
      .from(stationAlert)
      .where(
        and(
          eq(stationAlert.stationId, stationId),
          isNotNull(stationAlert.resolvedAt),
        ),
      )
      .orderBy(
        asc(stationAlert.measure),
        asc(stationAlert.condition),
        desc(stationAlert.resolvedAt),
        desc(stationAlert.id),
      );
    const openIds = new Set(alerts.map((each) => each.id));

    return toAlertState(row, [
      ...alerts,
      ...cooling.filter((each) => !openIds.has(each.id)),
    ]);
  }

  private async writeAlerts(alertState: StationAlertState): Promise<void> {
    if (alertState.dropped.length > 0) {
      await this.context.db.delete(stationAlert).where(
        and(
          eq(stationAlert.stationId, alertState.station.stationId),
          inArray(
            stationAlert.id,
            alertState.dropped.map((each) => each.value),
          ),
        ),
      );
    }

    if (alertState.changed.length === 0) {
      return;
    }

    await this.context.db
      .insert(stationAlert)
      .values(alertState.changed.map((each) => alertRowOf(alertState, each)))
      .onConflictDoUpdate({
        target: stationAlert.id,
        set: {
          threshold: sql`excluded.threshold`,
          over: sql`excluded.over`,
          value: sql`excluded.value`,
          baseline: sql`excluded.baseline`,
          resolvedAt: sql`excluded.resolved_at`,
          clearRuns: sql`excluded.clear_runs`,
          lastSeenRunId: sql`excluded.last_seen_run_id`,
        },
      });
  }
}
