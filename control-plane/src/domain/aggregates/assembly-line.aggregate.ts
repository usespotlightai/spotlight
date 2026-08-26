import { Station, type StationChanges } from '@domain/entities/station.entity';
import type { Template } from '@domain/entities/template.entity';
import { InvalidStationOrderError } from '@domain/exceptions/invalid-station-order.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

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
    return AssemblyLine.of({
      id: AssemblyLineId.of(input.newId()),
      workspaceId: input.workspaceId,
      factoryId: input.factoryId,
      name: AssemblyLineName.of(input.template.name.value),
      stations: input.template.stations.map((name, position) =>
        Station.create({
          id: StationId.of(input.newId()),
          name,
          position,
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

    return new AssemblyLine(
      input.id,
      input.workspaceId,
      input.factoryId,
      input.name,
      [...input.stations].sort((a, b) => a.position - b.position),
    );
  }

  customiseStation(
    stationId: StationId,
    changes: StationChanges,
  ): AssemblyLine {
    const target = this.stationAt(stationId);

    return AssemblyLine.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      name: this.name,
      stations: this.stations.map((each) =>
        each.equals(target) ? each.customise(changes) : each,
      ),
    });
  }

  stationAt(stationId: StationId): Station {
    const found = this.stations.find((each) => each.id.equals(stationId));

    if (!found) {
      throw new UnknownStationError(stationId.value);
    }

    return found;
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

  equals(other: AssemblyLine): boolean {
    return this.id.equals(other.id);
  }
}
