import { Station } from '@domain/entities/station.entity';
import type { Template } from '@domain/entities/template.entity';
import { InvalidStationOrderError } from '@domain/exceptions/invalid-station-order.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import type { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import type { RunnerPool } from '@domain/value-objects/runner-pool.vo';
import type { StationColor } from '@domain/value-objects/station-color.vo';
import type { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
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
      stations: input.template.stations.map((each, position) =>
        Station.create({
          id: StationId.of(input.newId()),
          name: each.name,
          color: each.color,
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

  assignStationTo(stationId: StationId, pool: RunnerPool | null): AssemblyLine {
    return this.withStation(stationId, (station) => station.assignTo(pool));
  }

  instructStation(
    stationId: StationId,
    agentPrompt: AgentPrompt | null,
  ): AssemblyLine {
    return this.withStation(stationId, (station) =>
      station.instruct(agentPrompt),
    );
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

  equals(other: AssemblyLine): boolean {
    return this.id.equals(other.id);
  }
}
