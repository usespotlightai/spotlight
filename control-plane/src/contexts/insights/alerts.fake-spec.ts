import { StationAlertState } from '@insights/domain/aggregates/station-alert-state.aggregate';
import { StationAlertStateVersionConflictError } from '@insights/domain/exceptions/station-alert-state-version-conflict.error';
import type { StationAlertStateRepository } from '@insights/domain/repositories/station-alert-state.repository';
import type { AlertFiring } from '@insights/domain/value-objects/alert-firing.vo';
import type { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class StationAlertStatesInMemory implements StationAlertStateRepository {
  readonly stored = new Map<string, StationAlertState>();
  readonly raised: DomainEvent[] = [];

  async add(alertState: StationAlertState): Promise<void> {
    if (this.stored.has(alertState.station.stationId.value)) {
      throw new StationAlertStateVersionConflictError(
        alertState.station.stationId.value,
      );
    }
    this.store(alertState, [], alertState.version);
  }

  async save(alertState: StationAlertState): Promise<void> {
    const existing = this.stored.get(alertState.station.stationId.value);

    if (!existing || existing.version !== alertState.version) {
      throw new StationAlertStateVersionConflictError(
        alertState.station.stationId.value,
      );
    }
    this.store(alertState, existing.firings, alertState.version + 1);
  }

  async of(stationId: StationId): Promise<StationAlertState | null> {
    return this.stored.get(stationId.value) ?? null;
  }

  async ofAlert(alertId: AlertId): Promise<StationAlertState | null> {
    return (
      [...this.stored.values()].find((each) => each.firing(alertId)) ?? null
    );
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly StationAlertState[]> {
    return [...this.stored.values()]
      .filter(
        (each) =>
          each.station.workspaceId.equals(scope.workspaceId) &&
          (scope.kind === 'workspace' ||
            (scope.kind === 'team' &&
              each.station.teamId.equals(scope.teamId)) ||
            (scope.kind === 'task' &&
              each.firings.some((firing) =>
                firing.taskId.equals(scope.taskId),
              ))),
      )
      .slice(0, max);
  }

  async remove(removed: StationAlertState): Promise<void> {
    if (
      this.stored.get(removed.station.stationId.value)?.version !==
      removed.version
    ) {
      throw new StationAlertStateVersionConflictError(
        removed.station.stationId.value,
      );
    }

    this.stored.delete(removed.station.stationId.value);
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
      alertState.station.stationId.value,
      StationAlertState.rehydrate({
        station: alertState.station,
        firings: [...retained, ...fresh],
        version,
      }),
    );
  }
}
