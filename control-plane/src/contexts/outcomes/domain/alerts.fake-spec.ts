import { StationWatch } from '@outcomes/domain/aggregates/station-watch.aggregate';
import { StationWatchVersionConflictError } from '@outcomes/domain/exceptions/station-watch-version-conflict.error';
import type { StationWatchRepository } from '@outcomes/domain/repositories/station-watch.repository';
import type { AlertCrossing } from '@outcomes/domain/value-objects/alert-crossing.vo';
import type { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class StationWatchesInMemory implements StationWatchRepository {
  readonly stored = new Map<string, StationWatch>();
  readonly raised: DomainEvent[] = [];

  async add(watch: StationWatch): Promise<void> {
    if (this.stored.has(watch.station.stationId)) {
      throw new StationWatchVersionConflictError(watch.station.stationId);
    }
    this.store(watch, [], watch.version);
  }

  async save(watch: StationWatch): Promise<void> {
    const existing = this.stored.get(watch.station.stationId);

    if (!existing || existing.version !== watch.version) {
      throw new StationWatchVersionConflictError(watch.station.stationId);
    }
    this.store(watch, existing.crossings, watch.version + 1);
  }

  async of(stationId: string, withTask?: TaskId): Promise<StationWatch | null> {
    return this.watchAt(
      stationId,
      (crossing) => withTask !== undefined && crossing.taskId.equals(withTask),
    );
  }

  async raising(alertId: AlertId): Promise<StationWatch | null> {
    const existing = [...this.stored.values()].find((each) =>
      each.crossing(alertId),
    );

    return existing
      ? this.watchAt(existing.station.stationId, (each) =>
          each.id.equals(alertId),
        )
      : null;
  }

  async stationsWithTask(taskId: TaskId): Promise<readonly string[]> {
    return [...this.stored.values()]
      .filter((each) =>
        each.crossings.some((crossing) => crossing.taskId.equals(taskId)),
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

  private watchAt(
    stationId: string,
    alsoIncluded: (crossing: AlertCrossing) => boolean,
  ): StationWatch | null {
    const existing = this.stored.get(stationId);

    if (!existing) {
      return null;
    }

    const lastRecovered = new Map<string, AlertCrossing>();

    for (const each of existing.crossings.filter((one) => !one.open)) {
      const last = lastRecovered.get(each.rule.key);

      if (
        !last ||
        (each.recoveredAt?.getTime() ?? 0) >= (last.recoveredAt?.getTime() ?? 0)
      ) {
        lastRecovered.set(each.rule.key, each);
      }
    }

    const cooling = new Set(
      [...lastRecovered.values()].map((each) => each.id.value),
    );

    return StationWatch.rehydrate({
      station: existing.station,
      crossings: existing.crossings.filter(
        (each) => each.open || alsoIncluded(each) || cooling.has(each.id.value),
      ),
      version: existing.version,
    });
  }

  private store(
    watch: StationWatch,
    before: readonly AlertCrossing[],
    version: number,
  ): void {
    const dropped = new Set(watch.dropped.map((each) => each.value));
    const changed = new Map(watch.changed.map((each) => [each.id.value, each]));
    const retained = before
      .filter((each) => !dropped.has(each.id.value))
      .map((each) => changed.get(each.id.value) ?? each);
    const fresh = watch.changed.filter(
      (each) => !retained.some((one) => one.id.equals(each.id)),
    );

    this.raised.push(...watch.pullEvents());
    this.stored.set(
      watch.station.stationId,
      StationWatch.rehydrate({
        station: watch.station,
        crossings: [...retained, ...fresh],
        version,
      }),
    );
  }
}
