import { StationAlertState } from '@insights/domain/aggregates/station-alert-state.aggregate';
import { StationAlertStateVersionConflictError } from '@insights/domain/exceptions/station-alert-state-version-conflict.error';
import type { StationAlertStateRepository } from '@insights/domain/repositories/station-alert-state.repository';
import type { AlertFiring } from '@insights/domain/value-objects/alert-firing.vo';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { inScope } from '@insights/infrastructure/persistence/drizzle/deletion-scope.sql';
import { firingOf } from '@insights/infrastructure/persistence/drizzle/mappers/alert-firing.mapper';
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
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

type AlertStateRow = typeof stationAlertState.$inferSelect;

type AlertRow = typeof stationAlert.$inferSelect;

const toAlertState = (
  row: AlertStateRow,
  alerts: readonly AlertRow[],
): StationAlertState =>
  StationAlertState.rehydrate({
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: LineId.of(row.lineId),
      stationId: StationId.of(row.stationId),
    },
    firings: alerts.map(firingOf),
    version: row.version,
  });

const alertRowOf = (alertState: StationAlertState, firing: AlertFiring) => ({
  id: firing.id.value,
  stationId: alertState.station.stationId.value,
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
          stationId: added.station.stationId.value,
          workspaceId: added.station.workspaceId.value,
          teamId: added.station.teamId.value,
          lineId: added.station.lineId.value,
          version: added.version,
        })
        .onConflictDoNothing()
        .returning({ stationId: stationAlertState.stationId });

      if (written.length === 0) {
        throw new StationAlertStateVersionConflictError(
          added.station.stationId.value,
        );
      }

      await this.writeAlerts(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: StationAlertState): Promise<void> {
    if (saved.isDeleted) {
      return this.removed(saved);
    }

    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(stationAlertState)
        .set({ version: saved.version + 1, lineId: saved.station.lineId.value })
        .where(
          and(
            eq(stationAlertState.stationId, saved.station.stationId.value),
            eq(stationAlertState.version, saved.version),
          ),
        )
        .returning({ stationId: stationAlertState.stationId });

      if (written.length === 0) {
        throw new StationAlertStateVersionConflictError(
          saved.station.stationId.value,
        );
      }

      await this.writeAlerts(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  async of(stationId: StationId): Promise<StationAlertState | null> {
    const [row] = await this.context.db
      .select()
      .from(stationAlertState)
      .where(eq(stationAlertState.stationId, stationId.value))
      .limit(1);

    return row ? this.withFirings(row) : null;
  }

  async ofAlert(alertId: AlertId): Promise<StationAlertState | null> {
    const [row] = await this.context.db
      .select({ stationId: stationAlert.stationId })
      .from(stationAlert)
      .where(eq(stationAlert.id, alertId.value))
      .limit(1);

    return row ? this.of(StationId.of(row.stationId)) : null;
  }

  private async removed(removed: StationAlertState): Promise<void> {
    const gone = await this.context.db
      .delete(stationAlertState)
      .where(
        and(
          eq(stationAlertState.stationId, removed.station.stationId.value),
          eq(stationAlertState.version, removed.version),
        ),
      )
      .returning({ stationId: stationAlertState.stationId });

    if (gone.length === 0) {
      throw new StationAlertStateVersionConflictError(
        removed.station.stationId.value,
      );
    }
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly StationAlertState[]> {
    const rows =
      scope.kind === 'task'
        ? await this.context.db
            .selectDistinct({ stationId: stationAlert.stationId })
            .from(stationAlert)
            .where(eq(stationAlert.taskId, scope.taskId.value))
            .limit(max)
        : await this.context.db
            .select({ stationId: stationAlertState.stationId })
            .from(stationAlertState)
            .where(inScope(stationAlertState, scope))
            .limit(max);
    const states = await Promise.all(
      rows.map((row) => this.of(StationId.of(row.stationId))),
    );

    return states.filter((each) => each !== null);
  }

  private async withFirings(row: AlertStateRow): Promise<StationAlertState> {
    const alerts = await this.context.db
      .select()
      .from(stationAlert)
      .where(eq(stationAlert.stationId, row.stationId))
      .orderBy(asc(stationAlert.firedAt), asc(stationAlert.id));

    return toAlertState(row, alerts);
  }

  private async writeAlerts(alertState: StationAlertState): Promise<void> {
    if (alertState.dropped.length > 0) {
      await this.context.db.delete(stationAlert).where(
        and(
          eq(stationAlert.stationId, alertState.station.stationId.value),
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
