import { Station } from '@domain/entities/station.entity';
import type { Template } from '@domain/entities/template.entity';
import { InvalidStationOrderError } from '@domain/exceptions/invalid-station-order.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import { handoverOptions } from '@domain/services/handover-options';
import type { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import type { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

const BACKLOG_NAME = StationName.of('Backlog');
const BACKLOG_COLOR = StationColor.of('#a3a8b0');

export class AssemblyLine {
  private constructor(
    readonly id: AssemblyLineId,
    readonly workspaceId: WorkspaceId,
    readonly factoryId: FactoryId,
    readonly name: AssemblyLineName,
    readonly stations: readonly Station[],
  ) {}

  static fromTemplate(input: {
    template: Template;
    workspaceId: WorkspaceId;
    factoryId: FactoryId;
    newId: () => string;
  }): AssemblyLine {
    return AssemblyLine.opened({
      id: AssemblyLineId.of(input.newId()),
      workspaceId: input.workspaceId,
      factoryId: input.factoryId,
      name: AssemblyLineName.of(input.template.name.value),
      newId: input.newId,
      stations: input.template.stations.map((each, position) =>
        Station.create({
          id: StationId.of(input.newId()),
          name: each.name,
          color: each.color,
          position: position + 1,
          agentPrompt: each.agentPrompt,
        }),
      ),
    });
  }

  static opened(input: {
    id: AssemblyLineId;
    workspaceId: WorkspaceId;
    factoryId: FactoryId;
    name: AssemblyLineName;
    stations: readonly Station[];
    newId: () => string;
  }): AssemblyLine {
    return AssemblyLine.of({
      ...input,
      stations: [
        Station.create({
          id: StationId.of(input.newId()),
          name: BACKLOG_NAME,
          color: BACKLOG_COLOR,
          position: 0,
          kind: 'backlog',
        }),
        ...input.stations,
      ],
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

  reorderStations(order: readonly StationId[]): AssemblyLine {
    if (order[0] && !this.backlog.id.equals(order[0])) {
      throw new InvalidStationOrderError(
        'must leave the backlog standing first',
      );
    }
    if (order.length !== this.stations.length) {
      throw new InvalidStationOrderError(
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
      throw new InvalidStationOrderError('must number at least one');
    }

    const positions = stations
      .map((each) => each.position)
      .sort((a, b) => a - b);

    if (positions.some((position, index) => position !== index)) {
      throw new InvalidStationOrderError(
        `must sit at positions 0 to ${stations.length - 1}, but sit at ${positions.join(', ')}`,
      );
    }
  }

  private static guardBacklogStandsFirst(stations: readonly Station[]): void {
    const backlogs = stations.filter((each) => each.isBacklog);

    if (backlogs.length !== 1) {
      throw new InvalidStationOrderError(
        `must hold one backlog, but hold ${backlogs.length}`,
      );
    }
    if (backlogs[0]?.position !== 0) {
      throw new InvalidStationOrderError(
        'must open with their backlog, which is where a task waits to start',
      );
    }
  }

  get backlog(): Station {
    const standing = this.stations.find((each) => each.isBacklog);

    if (!standing) {
      throw new InvalidStationOrderError('must hold one backlog, but hold 0');
    }

    return standing;
  }

  get worked(): readonly Station[] {
    return this.stations.filter((each) => !each.isBacklog);
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
  optionsFrom(stationId: StationId): string[] {
    return handoverOptions(this.worked, stationId);
  }

  equals(other: AssemblyLine): boolean {
    return this.id.equals(other.id);
  }
}
