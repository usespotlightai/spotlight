import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import { Template } from '@domain/entities/template.entity';
import { InvalidStationChangeError } from '@domain/exceptions/invalid-station-change.error';
import { InvalidStationOrderError } from '@domain/exceptions/invalid-station-order.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { DEFAULT_TEMPLATE } from '@domain/value-objects/built-in-templates';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
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
    color: StationColor.of('#a3a8b0'),
  });

const backlog = (position = 0) =>
  Station.create({
    id: StationId.of('backlog_1'),
    name: StationName.of('Backlog'),
    position,
    color: StationColor.of('#a3a8b0'),
    kind: 'backlog',
  });

const of = (stations: Station[]) =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations,
  });

const lineOf = (stations: Station[]) => of([backlog(), ...stations]);

const templateOf = (name: string, stations: string[]) =>
  Template.of({
    id: TemplateId.of('template_1'),
    name: TemplateName.of(name),
    stations: stations.map((each) => ({
      name: StationName.of(each),
      color: StationColor.of('#a3a8b0'),
      agentPrompt: null,
    })),
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
    expect(openedFrom(templateOf('Bug Fix', ['Triage'])).name.value).toBe(
      'Bug Fix',
    );
  });

  it('opens with the template’s stations, left to right', () => {
    const line = openedFrom(
      templateOf('Default', ['Triage', 'Spec', 'Implementation']),
    );

    expect(line.worked.map((each) => each.name.value)).toEqual([
      'Triage',
      'Spec',
      'Implementation',
    ]);
    expect(line.stations.map((each) => each.position)).toEqual([0, 1, 2, 3]);
  });

  it('opens each station with what the template says it is for', () => {
    const line = openedFrom(DEFAULT_TEMPLATE);

    expect(line.worked[0]?.agentPrompt?.value).toBe(
      DEFAULT_TEMPLATE.stations[0]?.agentPrompt?.value,
    );
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

  describe('the backlog it always has', () => {
    it('opens with one no template asked for', () => {
      const line = openedFrom(templateOf('Default', ['Triage']));

      expect(line.backlog.name.value).toBe('Backlog');
      expect(line.backlog.isBacklog).toBe(true);
    });

    it('stands it first, where a task waits to be started', () => {
      expect(
        openedFrom(templateOf('Default', ['Triage'])).backlog.position,
      ).toBe(0);
    });

    it('leaves it out of the stations work moves through', () => {
      const line = openedFrom(templateOf('Default', ['Triage']));

      expect(line.worked.map((each) => each.name.value)).toEqual(['Triage']);
    });

    it('refuses to run anything at it', () => {
      const line = openedFrom(templateOf('Default', ['Triage']));

      expect(() =>
        line.runStationOn(line.backlog.id, HarnessId.of('dev')),
      ).toThrow(InvalidStationChangeError);
    });

    it('refuses to be told anything, having nothing there to tell', () => {
      const line = openedFrom(templateOf('Default', ['Triage']));

      expect(() =>
        line.instructStation(line.backlog.id, AgentPrompt.of('## Sort it')),
      ).toThrow(InvalidStationChangeError);
    });

    it('still takes a new name', () => {
      const line = openedFrom(templateOf('Default', ['Triage']));
      const renamed = line.renameStation(
        line.backlog.id,
        StationName.of('Inbox'),
      );

      expect(renamed.backlog.name.value).toBe('Inbox');
    });

    it('will not let it be moved off the front', () => {
      const line = lineOf([at(1, 'Triage')]);

      expect(() =>
        line.reorderStations([StationId.of('station_1'), line.backlog.id]),
      ).toThrow(InvalidStationOrderError);
    });

    it('refuses a line without one', () => {
      expect(() => of([at(0)])).toThrow(InvalidStationOrderError);
    });

    it('refuses a line with more than one', () => {
      expect(() => of([backlog(), backlog(1)])).toThrow(
        InvalidStationOrderError,
      );
    });

    it('refuses one that does not stand first', () => {
      expect(() => of([at(0), backlog(1)])).toThrow(InvalidStationOrderError);
    });
  });

  it('changes the one station it was asked about', () => {
    const line = lineOf([at(1, 'Triage'), at(2, 'Spec')]);

    const assigned = line.runStationOn(
      StationId.of('station_1'),
      HarnessId.of('dev'),
    );

    expect(assigned.worked.map((each) => each.harness?.value ?? null)).toEqual([
      'dev',
      null,
    ]);
  });

  it('refuses to change a station it does not hold', () => {
    expect(() =>
      lineOf([at(1)]).runStationOn(
        StationId.of('station_missing'),
        HarnessId.of('dev'),
      ),
    ).toThrow(UnknownStationError);
  });

  it('leaves the line it was changed from untouched', () => {
    const line = lineOf([at(1)]);
    line.runStationOn(StationId.of('station_1'), HarnessId.of('dev'));

    expect(line.worked[0]?.harness).toBeNull();
  });

  it('holds its stations in board order however they arrive', () => {
    expect(
      lineOf([at(3), at(1), at(2)]).stations.map((e) => e.position),
    ).toEqual([0, 1, 2, 3]);
  });

  it('refuses a board with no stations at all', () => {
    expect(() => of([])).toThrow(InvalidStationOrderError);
  });

  it('refuses a gap in the positions', () => {
    expect(() => lineOf([at(2)])).toThrow(InvalidStationOrderError);
  });

  it('refuses two stations claiming the same place', () => {
    expect(() => lineOf([at(1), at(1)])).toThrow(InvalidStationOrderError);
  });

  it('refuses a station standing before the start of the board', () => {
    expect(() => lineOf([at(-1), at(1)])).toThrow(InvalidStationOrderError);
  });
});
