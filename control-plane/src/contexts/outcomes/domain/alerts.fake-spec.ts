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
  readonly held = new Map<string, StationWatch>();
  readonly raised: DomainEvent[] = [];

  async add(watch: StationWatch): Promise<void> {
    if (this.held.has(watch.station.stationId)) {
      throw new StationWatchVersionConflictError(watch.station.stationId);
    }
    this.keep(watch, [], watch.version);
  }

  async save(watch: StationWatch): Promise<void> {
    const held = this.held.get(watch.station.stationId);

    if (!held || held.version !== watch.version) {
      throw new StationWatchVersionConflictError(watch.station.stationId);
    }
    this.keep(watch, held.crossings, watch.version + 1);
  }

  async of(stationId: string, withTask?: TaskId): Promise<StationWatch | null> {
    return this.holding(
      stationId,
      (crossing) => withTask !== undefined && crossing.taskId.equals(withTask),
    );
  }

  async raising(alertId: AlertId): Promise<StationWatch | null> {
    const held = [...this.held.values()].find((each) => each.crossing(alertId));

    return held
      ? this.holding(held.station.stationId, (each) => each.id.equals(alertId))
      : null;
  }

  async stationsHolding(taskId: TaskId): Promise<readonly string[]> {
    return [...this.held.values()]
      .filter((each) =>
        each.crossings.some((crossing) => crossing.taskId.equals(taskId)),
      )
      .map((each) => each.station.stationId);
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (
        each.station.workspaceId.equals(workspaceId) &&
        each.station.teamId.equals(teamId)
      ) {
        this.held.delete(each.station.stationId);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.station.workspaceId.equals(workspaceId)) {
        this.held.delete(each.station.stationId);
      }
    }
  }

  private holding(
    stationId: string,
    alsoHeld: (crossing: AlertCrossing) => boolean,
  ): StationWatch | null {
    const held = this.held.get(stationId);

    if (!held) {
      return null;
    }

    const lastRecovered = new Map<string, AlertCrossing>();

    for (const each of held.crossings.filter((one) => !one.open)) {
      const last = lastRecovered.get(each.rule.key);

      if (
        !last ||
        (each.recoveredAt?.getTime() ?? 0) >= (last.recoveredAt?.getTime() ?? 0)
      ) {
        lastRecovered.set(each.rule.key, each);
      }
    }

    const settling = new Set(
      [...lastRecovered.values()].map((each) => each.id.value),
    );

    return StationWatch.rehydrate({
      station: held.station,
      crossings: held.crossings.filter(
        (each) => each.open || alsoHeld(each) || settling.has(each.id.value),
      ),
      version: held.version,
    });
  }

  private keep(
    watch: StationWatch,
    before: readonly AlertCrossing[],
    version: number,
  ): void {
    const dropped = new Set(watch.dropped.map((each) => each.value));
    const changed = new Map(watch.changed.map((each) => [each.id.value, each]));
    const kept = before
      .filter((each) => !dropped.has(each.id.value))
      .map((each) => changed.get(each.id.value) ?? each);
    const fresh = watch.changed.filter(
      (each) => !kept.some((one) => one.id.equals(each.id)),
    );

    this.raised.push(...watch.pullEvents());
    this.held.set(
      watch.station.stationId,
      StationWatch.rehydrate({
        station: watch.station,
        crossings: [...kept, ...fresh],
        version,
      }),
    );
  }
}
