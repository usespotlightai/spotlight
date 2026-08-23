import {
  AssemblyLine,
  DEFAULT_STATION_NAMES,
} from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import { InvalidStationOrderError } from '@domain/exceptions/invalid-station-order.error';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const at = (position: number, name = `Station ${position}`) =>
  Station.create({
    id: StationId.of(`station_${position}`),
    name: StationName.of(name),
    position,
  });

const lineOf = (stations: Station[]) =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations,
  });

const defaultLine = () => {
  let next = 0;
  return AssemblyLine.createDefault({
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    newId: () => `id_${++next}`,
  });
};

describe('AssemblyLine', () => {
  it('opens with the default stations, left to right', () => {
    const line = defaultLine();

    expect(line.stations.map((each) => each.name.value)).toEqual([
      ...DEFAULT_STATION_NAMES,
    ]);
    expect(line.stations.map((each) => each.position)).toEqual([0, 1, 2, 3]);
  });

  it('holds its stations in board order however they arrive', () => {
    const line = lineOf([at(2), at(0), at(1)]);

    expect(line.stations.map((each) => each.position)).toEqual([0, 1, 2]);
  });

  it('refuses a board with no stations at all', () => {
    expect(() => lineOf([])).toThrow(InvalidStationOrderError);
  });

  it('refuses a gap in the positions', () => {
    expect(() => lineOf([at(0), at(2)])).toThrow(InvalidStationOrderError);
  });

  it('refuses two stations claiming the same place', () => {
    expect(() => lineOf([at(0), at(0)])).toThrow(InvalidStationOrderError);
  });

  it('refuses a station standing before the start of the board', () => {
    expect(() => lineOf([at(-1), at(0)])).toThrow(InvalidStationOrderError);
  });
});
