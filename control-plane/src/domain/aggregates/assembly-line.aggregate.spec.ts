import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import { Template } from '@domain/entities/template.entity';
import { InvalidStationOrderError } from '@domain/exceptions/invalid-station-order.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { RunnerPool } from '@domain/value-objects/runner-pool.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TemplateId } from '@domain/value-objects/template-id.vo';
import { TemplateName } from '@domain/value-objects/template-name.vo';
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

const templateOf = (name: string, stations: string[]) =>
  Template.of({
    id: TemplateId.of('template_1'),
    name: TemplateName.of(name),
    stations: stations.map((each) => StationName.of(each)),
  });

const openedFrom = (template: Template) => {
  let next = 0;
  return AssemblyLine.fromTemplate({
    template,
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    newId: () => `id_${++next}`,
  });
};

describe('AssemblyLine', () => {
  it('takes its name from the template it opens from', () => {
    const line = openedFrom(templateOf('Bug Fix', ['Triage']));

    expect(line.name.value).toBe('Bug Fix');
  });

  it('opens with the template’s stations, left to right', () => {
    const line = openedFrom(
      templateOf('Default', ['Triage', 'Spec', 'Implementation']),
    );

    expect(line.stations.map((each) => each.name.value)).toEqual([
      'Triage',
      'Spec',
      'Implementation',
    ]);
    expect(line.stations.map((each) => each.position)).toEqual([0, 1, 2]);
  });

  it('gives the line and each of its stations an identity of its own', () => {
    const line = openedFrom(templateOf('Default', ['Triage', 'Spec']));

    const ids = [line.id.value, ...line.stations.map((each) => each.id.value)];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stands where it was opened', () => {
    const line = openedFrom(templateOf('Default', ['Triage']));

    expect(line.workspaceId).toEqual(WorkspaceId.of('ws_1'));
    expect(line.factoryId).toEqual(FactoryId.of('factory_1'));
  });

  it('customises the one station it was asked about', () => {
    const line = lineOf([at(0, 'Triage'), at(1, 'Spec')]);

    const customised = line.customiseStation(StationId.of('station_0'), {
      pool: RunnerPool.of('dev'),
    });

    expect(customised.stations.map((each) => each.pool?.value ?? null)).toEqual(
      ['dev', null],
    );
  });

  it('refuses to customise a station it does not hold', () => {
    const line = lineOf([at(0)]);

    expect(() =>
      line.customiseStation(StationId.of('station_missing'), {
        pool: RunnerPool.of('dev'),
      }),
    ).toThrow(UnknownStationError);
  });

  it('leaves the line it was customised from untouched', () => {
    const line = lineOf([at(0)]);
    line.customiseStation(StationId.of('station_0'), {
      pool: RunnerPool.of('dev'),
    });

    expect(line.stations[0]?.pool).toBeNull();
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
