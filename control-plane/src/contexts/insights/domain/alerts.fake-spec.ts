import { StationAlertState } from '@insights/domain/aggregates/station-alert-state.aggregate';
import { StationAlertStateVersionConflictError } from '@insights/domain/exceptions/station-alert-state-version-conflict.error';
import type { StationAlertStateRepository } from '@insights/domain/repositories/station-alert-state.repository';
import type { AlertFiring } from '@insights/domain/value-objects/alert-firing.vo';
import type { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class StationAlertStatesInMemory implements StationAlertStateRepository {
  readonly stored = new Map<string, StationAlertState>();
  readonly raised: DomainEvent[] = [];

  async add(alertState: StationAlertState): Promise<void> {
    if (this.stored.has(alertState.station.stationId)) {
      throw new StationAlertStateVersionConflictError(
        alertState.station.stationId,
      );
    }
    this.store(alertState, [], alertState.version);
  }

  async save(alertState: StationAlertState): Promise<void> {
    const existing = this.stored.get(alertState.station.stationId);

    if (!existing || existing.version !== alertState.version) {
      throw new StationAlertStateVersionConflictError(
        alertState.station.stationId,
      );
    }
    this.store(alertState, existing.firings, alertState.version + 1);
  }

  async of(
    stationId: string,
    withTask?: TaskId,
  ): Promise<StationAlertState | null> {
    return this.alertStateAt(
      stationId,
      (firing) => withTask !== undefined && firing.taskId.equals(withTask),
    );
  }

  async ofAlert(alertId: AlertId): Promise<StationAlertState | null> {
    const existing = [...this.stored.values()].find((each) =>
      each.firing(alertId),
    );

    return existing
      ? this.alertStateAt(existing.station.stationId, (each) =>
          each.id.equals(alertId),
        )
      : null;
  }

  async stationsWithTask(taskId: TaskId): Promise<readonly string[]> {
    return [...this.stored.values()]
      .filter((each) =>
        each.firings.some((firing) => firing.taskId.equals(taskId)),
      )
      .map((each) => each.station.stationId);
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (
        each.station.workspaceId.equals(workspaceId) &&
        each.station.teamId.equals(teamId)
      ) {
        this.stored.delete(each.station.stationId);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (each.station.workspaceId.equals(workspaceId)) {
        this.stored.delete(each.station.stationId);
      }
    }
  }

  private alertStateAt(
    stationId: string,
    alsoIncluded: (firing: AlertFiring) => boolean,
  ): StationAlertState | null {
    const existing = this.stored.get(stationId);

    if (!existing) {
      return null;
    }

    const lastResolved = new Map<string, AlertFiring>();

    for (const each of existing.firings.filter((one) => !one.open)) {
      const last = lastResolved.get(each.rule.key);

      if (
        !last ||
        (each.resolvedAt?.getTime() ?? 0) >= (last.resolvedAt?.getTime() ?? 0)
      ) {
        lastResolved.set(each.rule.key, each);
      }
    }

    const cooling = new Set(
      [...lastResolved.values()].map((each) => each.id.value),
    );

    return StationAlertState.rehydrate({
      station: existing.station,
      firings: existing.firings.filter(
        (each) => each.open || alsoIncluded(each) || cooling.has(each.id.value),
      ),
      version: existing.version,
    });
  }

  private store(
    alertState: StationAlertState,
    before: readonly AlertFiring[],
    version: number,
  ): void {
    const dropped = new Set(alertState.dropped.map((each) => each.value));
    const changed = new Map(
      alertState.changed.map((each) => [each.id.value, each]),
    );
    const retained = before
      .filter((each) => !dropped.has(each.id.value))
      .map((each) => changed.get(each.id.value) ?? each);
    const fresh = alertState.changed.filter(
      (each) => !retained.some((one) => one.id.equals(each.id)),
    );

    this.raised.push(...alertState.pullEvents());
    this.stored.set(
      alertState.station.stationId,
      StationAlertState.rehydrate({
        station: alertState.station,
        firings: [...retained, ...fresh],
        version,
      }),
    );
  }
}
