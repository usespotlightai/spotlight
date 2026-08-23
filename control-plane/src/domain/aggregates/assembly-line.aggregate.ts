import { Station } from '@domain/entities/station.entity';
import { InvalidStationOrderError } from '@domain/exceptions/invalid-station-order.error';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export const DEFAULT_ASSEMBLY_LINE_NAME = 'Default';

export const DEFAULT_STATION_NAMES = [
  'Triage',
  'Spec',
  'Implementation',
  'Code Review',
] as const;

export class AssemblyLine {
  private constructor(
    readonly id: AssemblyLineId,
    readonly workspaceId: WorkspaceId,
    readonly factoryId: FactoryId,
    readonly name: AssemblyLineName,
    readonly stations: readonly Station[],
  ) {}

  static createDefault(input: {
    workspaceId: WorkspaceId;
    factoryId: FactoryId;
    newId: () => string;
  }): AssemblyLine {
    const id = AssemblyLineId.of(input.newId());

    return AssemblyLine.of({
      id,
      workspaceId: input.workspaceId,
      factoryId: input.factoryId,
      name: AssemblyLineName.of(DEFAULT_ASSEMBLY_LINE_NAME),
      stations: DEFAULT_STATION_NAMES.map((name, position) =>
        Station.create({
          id: StationId.of(input.newId()),
          name: StationName.of(name),
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
    AssemblyLine.guardStations(input.stations);

    return new AssemblyLine(
      input.id,
      input.workspaceId,
      input.factoryId,
      input.name,
      [...input.stations].sort((a, b) => a.position - b.position),
    );
  }

  private static guardStations(stations: readonly Station[]): void {
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
