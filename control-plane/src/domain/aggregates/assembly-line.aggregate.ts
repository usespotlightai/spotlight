import { Station } from '@domain/entities/station.entity';
import { InvalidStationLayoutError } from '@domain/exceptions/invalid-station-layout.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import {
  BUILT_IN_STATIONS,
  type StationOpening,
} from '@domain/services/built-in-stations';
import { handoverOptions } from '@domain/services/handover-options';
import type { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import type { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HandoverOption } from '@domain/value-objects/handover-option.vo';
import type { Happening } from '@domain/value-objects/happening.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { StationColor } from '@domain/value-objects/station-color.vo';
import type { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class AssemblyLine {
  private constructor(
    readonly id: AssemblyLineId,
    readonly workspaceId: WorkspaceId,
    readonly factoryId: FactoryId,
    readonly name: AssemblyLineName,
    readonly stations: readonly Station[],
  ) {}

  static open(input: {
    workspaceId: WorkspaceId;
    factoryId: FactoryId;
    name: AssemblyLineName;
    newId: () => string;
  }): AssemblyLine {
    const named = BUILT_IN_STATIONS;
    const ids = named.map(() => StationId.of(input.newId()));

    // The openings name each other, so the ids exist before any station does.
    const at = (name: string): StationId => {
      const found = named.filter((each) => each.name.value === name);

      if (found.length !== 1) {
        throw new InvalidStationLayoutError(
          `must name one station "${name}", but name ${found.length}`,
        );
      }

      return ids[named.indexOf(found[0] as StationOpening)] as StationId;
    };

    return AssemblyLine.of({
      id: AssemblyLineId.of(input.newId()),
      workspaceId: input.workspaceId,
      factoryId: input.factoryId,
      name: input.name,
      stations: named.map((each, position) =>
        Station.create({
          id: ids[position] as StationId,
          name: each.name,
          color: each.color,
          position,
          kind: each.kind,
          agentPrompt: each.agentPrompt,
          wayOut: WayOut.of({
            stations: each.passesTo.map((to) => at(to)),
            ends: each.ends,
          }),
          reactsTo: each.reactsTo,
        }),
      ),
    });
  }

  static of(input: {
    id: AssemblyLineId;
    workspaceId: WorkspaceId;
    factoryId: FactoryId;
    name: AssemblyLineName;
    stations: readonly Station[];
  }): AssemblyLine {
    AssemblyLine.guardPositionsAreContiguous(input.stations);
    AssemblyLine.guardBacklogStandsFirst(input.stations);
    AssemblyLine.guardCompletedStandsLast(input.stations);
    AssemblyLine.guardEveryPassLandsOnTheLine(input.stations);
    AssemblyLine.guardNoHappeningIsClaimedTwice(input.stations);

    return new AssemblyLine(
      input.id,
      input.workspaceId,
      input.factoryId,
      input.name,
      [...input.stations].sort((a, b) => a.position - b.position),
    );
  }

  renameStation(stationId: StationId, name: StationName): AssemblyLine {
    return this.withStation(stationId, (station) => station.rename(name));
  }

  repaintStation(stationId: StationId, color: StationColor): AssemblyLine {
    return this.withStation(stationId, (station) => station.repaint(color));
  }

  describeStation(
    stationId: StationId,
    description: StationDescription | null,
  ): AssemblyLine {
    return this.withStation(stationId, (station) =>
      station.describe(description),
    );
  }

  runStationOn(stationId: StationId, harness: HarnessId | null): AssemblyLine {
    return this.withStation(stationId, (station) => station.runsOn(harness));
  }

  instructStation(
    stationId: StationId,
    agentPrompt: AgentPrompt | null,
  ): AssemblyLine {
    return this.withStation(stationId, (station) =>
      station.instruct(agentPrompt),
    );
  }

  reactionTo(happening: Happening): Station | null {
    return this.stations.find((each) => each.awaits(happening)) ?? null;
  }

  reorderStations(order: readonly StationId[]): AssemblyLine {
    if (order[0] && !this.backlog.id.equals(order[0])) {
      throw new InvalidStationLayoutError(
        'must leave the backlog standing first',
      );
    }
    if (
      order.length > 0 &&
      !this.completed.id.equals(order[order.length - 1] as StationId)
    ) {
      throw new InvalidStationLayoutError('must leave completed standing last');
    }
    if (order.length !== this.stations.length) {
      throw new InvalidStationLayoutError(
        `must name every station, but named ${order.length} of ${this.stations.length}`,
      );
    }

    const moved = order.map((stationId, position) => {
      const standing = this.stations.find((each) => each.id.equals(stationId));

      if (!standing) {
        throw new UnknownStationError(stationId.value);
      }

      return standing.movedTo(position);
    });

    return AssemblyLine.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      name: this.name,
      stations: moved,
    });
  }

  private withStation(
    stationId: StationId,
    change: (station: Station) => Station,
  ): AssemblyLine {
    const target = this.stations.find((each) => each.id.equals(stationId));

    if (!target) {
      throw new UnknownStationError(stationId.value);
    }

    return AssemblyLine.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      name: this.name,
      stations: this.stations.map((each) =>
        each.equals(target) ? change(each) : each,
      ),
    });
  }

  private static guardPositionsAreContiguous(
    stations: readonly Station[],
  ): void {
    if (stations.length === 0) {
      throw new InvalidStationLayoutError('must number at least one');
    }

    const positions = stations
      .map((each) => each.position)
      .sort((a, b) => a - b);

    if (positions.some((position, index) => position !== index)) {
      throw new InvalidStationLayoutError(
        `must sit at positions 0 to ${stations.length - 1}, but sit at ${positions.join(', ')}`,
      );
    }
  }

  private static guardBacklogStandsFirst(stations: readonly Station[]): void {
    const backlogs = stations.filter((each) => each.isBacklog);

    if (backlogs.length !== 1) {
      throw new InvalidStationLayoutError(
        `must hold one backlog, but hold ${backlogs.length}`,
      );
    }
    if (backlogs[0]?.position !== 0) {
      throw new InvalidStationLayoutError(
        'must open with their backlog, which is where a task waits to start',
      );
    }
  }

  private static guardEveryPassLandsOnTheLine(
    stations: readonly Station[],
  ): void {
    const worked = new Set(
      stations.filter((each) => each.isWorked).map((each) => each.id.value),
    );

    for (const station of stations) {
      if (station.isCompleted && station.wayOut.stations.length > 0) {
        throw new InvalidStationLayoutError(
          'must end where they end, but completed hands on somewhere',
        );
      }

      for (const to of station.wayOut.stations) {
        if (to.equals(station.id)) {
          throw new InvalidStationLayoutError(
            `must not hand on to themselves, but ${station.name.value} does`,
          );
        }
        // Handing a task somewhere nobody works it would strand it.
        if (!worked.has(to.value)) {
          throw new InvalidStationLayoutError(
            `must hand on to a station work is done at, but ${station.name.value} does not`,
          );
        }
      }
    }
  }

  private static guardNoHappeningIsClaimedTwice(
    stations: readonly Station[],
  ): void {
    const claimed = new Set<string>();

    for (const station of stations) {
      for (const happening of station.reactsTo) {
        if (claimed.has(happening)) {
          throw new InvalidStationLayoutError(
            `must send a happening to one station, but two wait for "${happening}"`,
          );
        }
        claimed.add(happening);
      }
    }
  }

  private static guardCompletedStandsLast(stations: readonly Station[]): void {
    const ends = stations.filter((each) => each.isCompleted);

    if (ends.length !== 1) {
      throw new InvalidStationLayoutError(
        `must hold one completed, but hold ${ends.length}`,
      );
    }
    if (ends[0]?.position !== stations.length - 1) {
      throw new InvalidStationLayoutError(
        'must close with completed, which is where a merged task lands',
      );
    }
  }

  get completed(): Station {
    const standing = this.stations.find((each) => each.isCompleted);

    if (!standing) {
      throw new InvalidStationLayoutError(
        'must hold one completed, but hold 0',
      );
    }

    return standing;
  }

  get backlog(): Station {
    const standing = this.stations.find((each) => each.isBacklog);

    if (!standing) {
      throw new InvalidStationLayoutError('must hold one backlog, but hold 0');
    }

    return standing;
  }

  get worked(): readonly Station[] {
    return this.stations.filter((each) => each.isWorked);
  }

  /**
   * The station standing at this id, asked of the line rather than found in
   * it: a station is the line's to give out, and the line is what knows
   * whether it has one.
   */
  stationAt(stationId: StationId): Station | null {
    return this.stations.find((each) => each.id.equals(stationId)) ?? null;
  }

  /** True where this line is the one holding that station. */
  holds(stationId: StationId): boolean {
    return this.stationAt(stationId) !== null;
  }

  /** Where a task standing here may be handed on to, or a person. */
  optionsFrom(stationId: StationId): HandoverOption[] {
    return handoverOptions(this.stationAt(stationId), this.stations);
  }

  equals(other: AssemblyLine): boolean {
    return this.id.equals(other.id);
  }
}
