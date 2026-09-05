import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import { InvalidStationChangeError } from '@domain/exceptions/invalid-station-change.error';
import { InvalidStationLayoutError } from '@domain/exceptions/invalid-station-layout.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import { BUILT_IN_STATIONS } from '@domain/services/built-in-stations';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { Reaction } from '@domain/value-objects/reaction.vo';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const at = (
  position: number,
  name = `Station ${position}`,
  ways: { passesTo?: string[] } = {},
) =>
  Station.create({
    id: StationId.of(`station_${position}`),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    wayOut: WayOut.of({ stations: (ways.passesTo ?? []).map(StationId.of) }),
  });

const backlog = (position = 0) =>
  Station.create({
    id: StationId.of('backlog_1'),
    name: StationName.of('Backlog'),
    position,
    color: StationColor.of('#a3a8b0'),
    kind: 'backlog',
  });

const completed = (position: number) =>
  Station.create({
    id: StationId.of('completed_1'),
    name: StationName.of('Completed'),
    position,
    color: StationColor.of('#a3a8b0'),
    kind: 'completed',
  });

const of = (stations: Station[], reactions: Reaction[] = []) =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations,
    reactions,
  });

const lineOf = (stations: Station[], reactions: Reaction[] = []) =>
  of([backlog(), ...stations, completed(stations.length + 1)], reactions);

const COMMENTED = Happening.of('github.pull_request.commented');

const sends = (to: string, from?: string) =>
  Reaction.of({
    happening: COMMENTED,
    from: from ? StationId.of(from) : null,
    to: StationId.of(to),
  });

const opened = (name = 'Default') => {
  let next = 0;
  return AssemblyLine.open({
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of(name),
    newId: () => `id_${++next}`,
  });
};

describe('AssemblyLine', () => {
  it('takes the name it was opened under', () => {
    expect(opened('Bug Fix').name.value).toBe('Bug Fix');
  });

  it('opens with the stations a line is made of, left to right', () => {
    const line = opened();

    expect(line.stations.map((each) => each.name.value)).toEqual(
      BUILT_IN_STATIONS.map((each) => each.name.value),
    );
    expect(line.stations.map((each) => each.position)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it('opens each station with what it is there to do', () => {
    expect(opened().worked[0]?.agentPrompt?.value).toBe(
      BUILT_IN_STATIONS[1]?.agentPrompt?.value,
    );
  });

  it('gives the line and each of its stations an identity of its own', () => {
    const line = opened();
    const ids = [line.id.value, ...line.stations.map((each) => each.id.value)];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stands where it was opened', () => {
    const line = opened();

    expect(line.workspaceId).toEqual(WorkspaceId.of('ws_1'));
    expect(line.factoryId).toEqual(FactoryId.of('factory_1'));
  });

  describe('the backlog it always has', () => {
    it('opens with one, whoever asked', () => {
      const line = opened();

      expect(line.backlog.name.value).toBe('Backlog');
      expect(line.backlog.isBacklog).toBe(true);
    });

    it('stands it first, where a task waits to be started', () => {
      expect(opened().backlog.position).toBe(0);
    });

    it('leaves it out of the stations work moves through', () => {
      const line = opened();

      expect(line.worked.map((each) => each.name.value)).toEqual(
        BUILT_IN_STATIONS.filter((each) => each.kind === 'work').map(
          (each) => each.name.value,
        ),
      );
    });

    it('refuses to run anything at it', () => {
      const line = opened();

      expect(() =>
        line.runStationOn(line.backlog.id, HarnessId.of('dev')),
      ).toThrow(InvalidStationChangeError);
    });

    it('refuses to be told anything, having nothing there to tell', () => {
      const line = opened();

      expect(() =>
        line.instructStation(line.backlog.id, AgentPrompt.of('## Sort it')),
      ).toThrow(InvalidStationChangeError);
    });

    it('still takes a new name', () => {
      const line = opened();
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
      ).toThrow(InvalidStationLayoutError);
    });

    it('refuses a line without one', () => {
      expect(() => of([at(0)])).toThrow(InvalidStationLayoutError);
    });

    it('refuses a line with more than one', () => {
      expect(() => of([backlog(), backlog(1)])).toThrow(
        InvalidStationLayoutError,
      );
    });

    it('refuses one that does not stand first', () => {
      expect(() => of([at(0), backlog(1)])).toThrow(InvalidStationLayoutError);
    });
  });

  describe('the completed it always has', () => {
    it('opens with one, whoever asked', () => {
      const line = opened();

      expect(line.completed.name.value).toBe('Completed');
      expect(line.completed.isCompleted).toBe(true);
    });

    it('stands it last, where a merged task lands', () => {
      const line = opened();

      expect(line.completed.position).toBe(line.stations.length - 1);
    });

    it('leaves it out of the stations work moves through', () => {
      const line = opened();

      expect(line.worked.map((each) => each.name.value)).toEqual(
        BUILT_IN_STATIONS.filter((each) => each.kind === 'work').map(
          (each) => each.name.value,
        ),
      );
    });

    it('refuses to run anything at it', () => {
      const line = opened();

      expect(() =>
        line.runStationOn(line.completed.id, HarnessId.of('dev')),
      ).toThrow(InvalidStationChangeError);
    });

    it('refuses to be told anything, having nothing there to tell', () => {
      const line = opened();

      expect(() =>
        line.instructStation(line.completed.id, AgentPrompt.of('## Sort it')),
      ).toThrow(InvalidStationChangeError);
    });

    it('will not let it be moved off the end', () => {
      const line = lineOf([at(1, 'Triage')]);

      expect(() =>
        line.reorderStations([
          line.backlog.id,
          line.completed.id,
          StationId.of('station_1'),
        ]),
      ).toThrow(InvalidStationLayoutError);
    });

    it('refuses a line without one', () => {
      expect(() => of([backlog(), at(1)])).toThrow(InvalidStationLayoutError);
    });

    it('refuses a line with more than one', () => {
      expect(() => of([backlog(), completed(1), completed(2)])).toThrow(
        InvalidStationLayoutError,
      );
    });

    it('refuses one that does not stand last', () => {
      expect(() => of([backlog(), completed(1), at(2)])).toThrow(
        InvalidStationLayoutError,
      );
    });
  });

  describe('the way work moves through it', () => {
    it('opens with the ways out it is laid out with', () => {
      const line = opened();
      const named = (name: string) =>
        line.stations
          .find((each) => each.name.value === name)
          ?.wayOut.stations.map(
            (id) => line.stationAt(id)?.name.value ?? 'nowhere',
          );

      expect(named('Backlog')).toEqual(['Triage']);
      expect(named('Triage')).toEqual(['Spec', 'Implementation']);
      expect(named('Spec')).toEqual(['Implementation']);
      expect(named('Implementation')).toEqual(['Code Review']);
      expect(named('Code Review')).toEqual(['Implementation']);
    });

    it('lets one station end the line, and no other', () => {
      const finishing = opened()
        .stations.filter((each) => each.wayOut.ends)
        .map((each) => each.name.value);

      expect(finishing).toEqual(['Code Review']);
    });

    it('refuses a way out that lands off the line', () => {
      expect(() =>
        lineOf([at(1, 'Triage', { passesTo: ['station_elsewhere'] })]),
      ).toThrow(InvalidStationLayoutError);
    });

    it('refuses a station that hands on to itself', () => {
      expect(() =>
        lineOf([at(1, 'Triage', { passesTo: ['station_1'] })]),
      ).toThrow(InvalidStationLayoutError);
    });

    it('refuses a way out of the end of the line', () => {
      expect(() =>
        of([
          backlog(),
          at(1, 'Triage'),
          Station.create({
            id: StationId.of('completed_1'),
            name: StationName.of('Completed'),
            position: 2,
            color: StationColor.of('#a3a8b0'),
            kind: 'completed',
            wayOut: WayOut.of({ stations: [StationId.of('station_1')] }),
          }),
        ]),
      ).toThrow(InvalidStationLayoutError);
    });
  });

  describe('what it waits for from outside', () => {
    const somewhere = () => opened().stations[1]?.id as StationId;

    const named = (line: AssemblyLine, reaction: { to: StationId } | null) =>
      reaction ? line.stationAt(reaction.to)?.name.value : null;

    it('sends a happening to the station set to wait for it', () => {
      const line = opened();

      expect(
        named(
          line,
          line.reactionTo(
            Happening.of('github.pull_request.merged'),
            somewhere(),
          ),
        ),
      ).toBe('Completed');
      expect(
        named(
          line,
          line.reactionTo(
            Happening.of('github.pull_request.commented'),
            somewhere(),
          ),
        ),
      ).toBe('Code Review');
    });

    it('sends a happening nobody waits for nowhere', () => {
      expect(
        opened().reactionTo(
          Happening.of('github.pull_request.closed-unmerged'),
          somewhere(),
        ),
      ).toBeNull();
    });

    it('refuses two stations waiting for the same word', () => {
      expect(() =>
        lineOf(
          [at(1, 'Triage'), at(2, 'Spec')],
          [sends('station_1'), sends('station_2')],
        ),
      ).toThrow(InvalidStationLayoutError);
    });

    it('refuses a rule sending a word off the line', () => {
      expect(() =>
        lineOf([at(1, 'Triage')], [sends('station_nowhere')]),
      ).toThrow(InvalidStationLayoutError);
    });

    // A comment at review is an answer; the same comment at spec is a
    // question to go back to.
    it('lets a rule name where the task stands, and prefers it', () => {
      const line = lineOf(
        [at(1, 'Triage'), at(2, 'Spec')],
        [sends('station_1'), sends('station_2', 'station_1')],
      );

      expect(line.reactionTo(COMMENTED, StationId.of('station_1'))?.to).toEqual(
        StationId.of('station_2'),
      );
      expect(line.reactionTo(COMMENTED, StationId.of('station_2'))?.to).toEqual(
        StationId.of('station_1'),
      );
    });

    it('lets two stations wait for the same word from different places', () => {
      expect(() =>
        lineOf(
          [at(1, 'Triage'), at(2, 'Spec')],
          [sends('station_1', 'station_2'), sends('station_2', 'station_1')],
        ),
      ).not.toThrow();
    });

    // A word about work nobody here has yet opens a task where the line
    // watches, rather than moving one that is not there.
    const ISSUE_CREATED = Happening.of('linear.issue.created');
    const REGRESSED = Happening.of('sentry.issue.regressed');
    const opensLinear = { opens: [ISSUE_CREATED], moves: [] };
    const withLinear = () => opened().installing(opensLinear);

    it('opens what a chosen source opens, at the backlog, and only once', () => {
      const line = withLinear();

      expect(line.opensAt(ISSUE_CREATED)?.id).toEqual(line.backlog.id);
      expect(line.installing(opensLinear)).toBe(line);
    });

    it('moves a standing task on for a word a chosen source moves, once', () => {
      const line = opened().installing({
        opens: [],
        moves: [{ happening: REGRESSED, to: 'Implementation' }],
      });

      expect(named(line, line.reactionTo(REGRESSED, somewhere()))).toBe(
        'Implementation',
      );
      expect(
        line.installing({
          opens: [],
          moves: [{ happening: REGRESSED, to: 'Implementation' }],
        }),
      ).toBe(line);
    });

    it('installs nothing a source names no station on the line for', () => {
      const line = opened();

      expect(
        line.installing({
          opens: [],
          moves: [{ happening: REGRESSED, to: 'Nowhere' }],
        }),
      ).toBe(line);
    });

    it('installs nothing for a source that contributes nothing', () => {
      const line = opened();

      expect(line.installing({ opens: [], moves: [] })).toBe(line);
    });

    it('opens nothing for a word it does not watch for', () => {
      expect(
        withLinear().opensAt(Happening.of('linear.issue.deleted')),
      ).toBeNull();
    });

    // Moving a task and opening one are different rules: what the world knows
    // as an opener never comes back as somewhere to take an existing task.
    it('does not take an opening rule as somewhere to move a task', () => {
      expect(withLinear().reactionTo(ISSUE_CREATED, somewhere())).toBeNull();
    });

    it('drops what it did on a source’s words when that source is taken away', () => {
      const line = withLinear().withoutRulesFrom(SourceKey.of('linear'));

      expect(line.opensAt(ISSUE_CREATED)).toBeNull();
      expect(
        named(
          line,
          line.reactionTo(
            Happening.of('github.pull_request.merged'),
            somewhere(),
          ),
        ),
      ).toBe('Completed');
    });

    it('is left as it was when the source did nothing here', () => {
      const line = opened();

      expect(line.withoutRulesFrom(SourceKey.of('sentry'))).toBe(line);
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
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it('refuses a board with no stations at all', () => {
    expect(() => of([])).toThrow(InvalidStationLayoutError);
  });

  it('refuses a gap in the positions', () => {
    expect(() => lineOf([at(2)])).toThrow(InvalidStationLayoutError);
  });

  it('refuses two stations claiming the same place', () => {
    expect(() => lineOf([at(1), at(1)])).toThrow(InvalidStationLayoutError);
  });

  it('refuses a station standing before the start of the board', () => {
    expect(() => lineOf([at(-1), at(1)])).toThrow(InvalidStationLayoutError);
  });
});
