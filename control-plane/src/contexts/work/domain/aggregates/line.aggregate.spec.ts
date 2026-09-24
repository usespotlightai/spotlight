import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { LineOpened } from '@work/domain/events/line-opened.event';
import { LineRedefined } from '@work/domain/events/line-redefined.event';
import { LineRepositoriesChanged } from '@work/domain/events/line-repositories-changed.event';
import { LineRetired } from '@work/domain/events/line-retired.event';
import { StationHarnessChanged } from '@work/domain/events/station-harness-changed.event';
import { StationRenamed } from '@work/domain/events/station-renamed.event';
import { InvalidStationChangeError } from '@work/domain/exceptions/invalid-station-change.error';
import { InvalidStationLayoutError } from '@work/domain/exceptions/invalid-station-layout.error';
import { LineInUseError } from '@work/domain/exceptions/line-in-use.error';
import { LineKeyFixedError } from '@work/domain/exceptions/line-key-fixed.error';
import { LineMovedOnError } from '@work/domain/exceptions/line-moved-on.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';

const BUILT_IN_STATIONS = BUILT_IN_LINES[0]?.stations ?? [];

import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';
import { describe, expect, it } from 'vitest';

const at = (
  position: number,
  name = `Station ${position}`,
  ways: { passesTo?: string[]; key?: string } = {},
) =>
  Station.of({
    id: StationId.of(`station_${position}`),
    key: StationKey.of(ways.key ?? `station-${position}`),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    wayOut: WayOut.of({ stations: (ways.passesTo ?? []).map(StationId.of) }),
  });

const backlog = (position = 0) =>
  Station.of({
    id: StationId.of('backlog_1'),
    key: StationKey.of('backlog'),
    name: StationName.of('Backlog'),
    position,
    color: StationColor.of('#a3a8b0'),
    kind: 'backlog',
  });

const completed = (position: number) =>
  Station.of({
    id: StationId.of('completed_1'),
    key: StationKey.of('completed'),
    name: StationName.of('Completed'),
    position,
    color: StationColor.of('#a3a8b0'),
    kind: 'completed',
  });

const of = (stations: Station[], reactions: Reaction[] = []) =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
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

const opened = () => {
  let next = 0;
  return Line.open({
    by: attributedIn(),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    line: BUILT_IN_LINES[0] as LineOpening,
    newId: () => `id_${++next}`,
  });
};

describe('Line', () => {
  it('takes the name of the line it opens', () => {
    expect(opened().name.value).toBe('Delivery');
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
    expect(line.teamId).toEqual(TeamId.of('team_1'));
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
        line.changeStationHarness(line.backlog.id, {
          harness: HarnessId.of('dev'),
        }),
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
        line.changeStationHarness(line.completed.id, {
          harness: HarnessId.of('dev'),
        }),
      ).toThrow(InvalidStationChangeError);
    });

    it('refuses to be told anything, having nothing there to tell', () => {
      const line = opened();

      expect(() =>
        line.instructStation(line.completed.id, AgentPrompt.of('## Sort it')),
      ).toThrow(InvalidStationChangeError);
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
          Station.of({
            id: StationId.of('completed_1'),
            key: StationKey.of('completed'),
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

  describe('how far downstream a station stands', () => {
    const depth = (line: Line, name: string) => {
      const station = line.stations.find((each) => each.name.value === name);
      return station ? line.depthOf(station.id) : -1;
    };

    it('is the shortest distance from the backlog along the flow', () => {
      const line = opened();

      expect(depth(line, 'Backlog')).toBe(0);
      expect(depth(line, 'Triage')).toBe(1);
      expect(depth(line, 'Spec')).toBe(2);
      expect(depth(line, 'Code Review')).toBe(3);
    });

    it('stands a fork’s branches at the same depth', () => {
      const line = opened();

      expect(depth(line, 'Implementation')).toBe(depth(line, 'Spec'));
    });

    it('does not count rework that loops back', () => {
      const line = opened();

      expect(depth(line, 'Implementation')).toBe(2);
    });

    it('stands what finishes the line last of all', () => {
      const line = opened();
      const furthest = Math.max(
        ...line.worked.map((each) => line.depthOf(each.id)),
      );

      expect(depth(line, 'Completed')).toBeGreaterThan(furthest);
    });
  });

  describe('what it waits for from outside', () => {
    const somewhere = () => opened().stations[1]?.id as StationId;

    const named = (line: Line, reaction: { to: StationId } | null) =>
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
  });

  it('changes the one station it was asked about', () => {
    const line = lineOf([at(1, 'Triage'), at(2, 'Spec')]);

    const assigned = line.changeStationHarness(StationId.of('station_1'), {
      harness: HarnessId.of('dev'),
      model: HarnessModel.of('dev-large'),
    });

    expect(assigned.worked.map((each) => each.harness?.value ?? null)).toEqual([
      'dev',
      null,
    ]);
    expect(assigned.worked.map((each) => each.model?.value ?? null)).toEqual([
      'dev-large',
      null,
    ]);
  });

  it('refuses to change a station it does not hold', () => {
    expect(() =>
      lineOf([at(1)]).changeStationHarness(StationId.of('station_missing'), {
        harness: HarnessId.of('dev'),
      }),
    ).toThrow(UnknownStationError);
  });

  it('leaves the line it was changed from untouched', () => {
    const line = lineOf([at(1)]);
    line.changeStationHarness(StationId.of('station_1'), {
      harness: HarnessId.of('dev'),
    });

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
    expect(() => lineOf([at(-1, 'Before', { key: 'before' }), at(1)])).toThrow(
      InvalidStationLayoutError,
    );
  });

  describe('the harness its stations run on', () => {
    it('runs every work station on the one chosen, leaving the rest alone', () => {
      const line = opened().runsOn(
        HarnessId.of('claude-code'),
        HarnessModel.of('claude-sonnet-5'),
      );

      expect(
        line.worked.every((each) => each.harness?.value === 'claude-code'),
      ).toBe(true);
      expect(
        line.worked.every((each) => each.model?.value === 'claude-sonnet-5'),
      ).toBe(true);
      expect(line.backlog.harness).toBeNull();
      expect(line.completed.harness).toBeNull();
    });

    it('takes the harness off every work station when given none', () => {
      const line = opened()
        .runsOn(HarnessId.of('claude-code'), HarnessModel.of('claude-sonnet-5'))
        .runsOn(null, null);

      expect(line.worked.every((each) => each.harness === null)).toBe(true);
      expect(line.worked.every((each) => each.model === null)).toBe(true);
    });
  });
});

describe('Line, the stations it names by key', () => {
  it('names each station once', () => {
    expect(() =>
      of([
        backlog(),
        at(1, 'Spec', { key: 'spec' }),
        at(2, 'Also Spec', { key: 'spec' }),
        completed(3),
      ]),
    ).toThrow(InvalidStationLayoutError);
  });

  it('changes a station’s harness or its model, keeping whichever it was not told', () => {
    const line = of([
      backlog(),
      Station.of({
        id: StationId.of('station_1'),
        key: StationKey.of('spec'),
        name: StationName.of('Spec'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        harness: HarnessId.of('dev'),
        model: HarnessModel.of('claude-sonnet-5'),
      }),
      completed(2),
    ]);
    const spec = StationId.of('station_1');

    const remodelled = line
      .changeStationHarness(spec, { model: HarnessModel.of('claude-opus-5') })
      .stationAt(spec);
    const moved = line
      .changeStationHarness(spec, { harness: HarnessId.of('other') })
      .stationAt(spec);

    expect(remodelled?.harness?.value).toBe('dev');
    expect(remodelled?.model?.value).toBe('claude-opus-5');
    expect(moved?.harness?.value).toBe('other');
    expect(moved?.model?.value).toBe('claude-sonnet-5');
  });
});

describe('Line, where work may be handed on to', () => {
  const running = () =>
    opened().runsOn(
      HarnessId.of('claude-code'),
      HarnessModel.of('claude-sonnet-5'),
    );

  const keyed = (line: Line, key: string) =>
    line.stations.find((each) => each.key.value === key) as Station;

  it('lets work pass along a way out to a station something runs at', () => {
    const line = running();

    expect(
      line.refusalToPass(keyed(line, 'triage').id, keyed(line, 'spec')),
    ).toBeNull();
  });

  it('refuses to pass work back to where it already stands', () => {
    const line = running();

    expect(
      line.refusalToPass(keyed(line, 'triage').id, keyed(line, 'triage')),
    ).toBe('standing-there');
  });

  it('refuses to pass work to a station nothing runs at', () => {
    const line = opened();

    expect(
      line.refusalToPass(keyed(line, 'triage').id, keyed(line, 'spec')),
    ).toBe('nothing-runs');
  });

  it('refuses to pass work where no way out leads', () => {
    const line = running();

    expect(
      line.refusalToPass(keyed(line, 'triage').id, keyed(line, 'code-review')),
    ).toBe('no-way');
  });

  it('offers the stations work passes to, then a person', () => {
    const line = running();

    expect(
      line.optionsFrom(keyed(line, 'triage').id).map((each) => each.word),
    ).toEqual(['spec', 'implementation', 'review']);
  });

  it('offers finishing only where the line ends', () => {
    const line = running();

    expect(
      line.optionsFrom(keyed(line, 'code-review').id).map((each) => each.word),
    ).toEqual(['implementation', 'review', 'done']);
  });

  it('offers only a person from a station it does not hold', () => {
    expect(
      running()
        .optionsFrom(StationId.of('station_missing'))
        .map((each) => each.word),
    ).toEqual(['review']);
  });

  it('says whether the line ends at a station', () => {
    const line = running();

    expect(line.endsAt(keyed(line, 'code-review').id)).toBe(true);
    expect(line.endsAt(keyed(line, 'triage').id)).toBe(false);
    expect(line.endsAt(StationId.of('station_missing'))).toBe(false);
  });
});

describe('Line, what it records of its changes', () => {
  const standing = () => of([backlog(), at(1, 'Build'), completed(2)]);

  it('records a station renamed, with what it was called', () => {
    const renamed = standing().renameStation(
      StationId.of('station_1'),
      StationName.of('Implement'),
    );

    const [event] = renamed.pullEvents();

    expect(event).toBeInstanceOf(StationRenamed);
    expect((event as StationRenamed).from.value).toBe('Build');
    expect((event as StationRenamed).to.value).toBe('Implement');
  });

  it('records nothing where a station keeps the name it had', () => {
    expect(
      standing()
        .renameStation(StationId.of('station_1'), StationName.of('Build'))
        .pullEvents(),
    ).toEqual([]);
  });

  it('records the repositories it works in changing', () => {
    const moved = standing().worksIn([Repository.of('acme/api')]);

    const [event] = moved.pullEvents();

    expect(event).toBeInstanceOf(LineRepositoriesChanged);
    expect(
      (event as LineRepositoriesChanged).repositories.all.map(
        (each) => each.value,
      ),
    ).toEqual(['acme/api']);
    expect(moved.worksIn([Repository.of('acme/api')]).pullEvents()).toEqual([]);
  });

  it('records the harness a station runs on changing', () => {
    const events = standing()
      .runsOn(HarnessId.of('claude-code'), null)
      .pullEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(StationHarnessChanged);
    expect((events[0] as StationHarnessChanged).harness?.value).toBe(
      'claude-code',
    );
  });

  it('keeps every change it records, one after another', () => {
    const events = standing()
      .runsOn(HarnessId.of('claude-code'), null)
      .renameStation(StationId.of('station_1'), StationName.of('Implement'))
      .pullEvents();

    expect(events.map((each) => each.kind)).toEqual([
      'line.station-harness-changed',
      'line.station-renamed',
    ]);
  });

  it('records nothing for a line read back as it was stored', () => {
    expect(standing().pullEvents()).toEqual([]);
  });

  it('keeps the version it was read at through its changes', () => {
    const read = Line.rehydrate({
      id: LineId.of('line_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      key: LineKey.of('default'),
      name: LineName.of('Default'),
      stations: standing().stations,
      version: 4,
    });

    expect(read.worksIn([Repository.of('acme/api')]).version).toBe(4);
  });

  it('says the harness it runs on is its first work station’s', () => {
    expect(
      standing().runsOn(HarnessId.of('claude-code'), null).harness?.value,
    ).toBe('claude-code');
    expect(standing().harness).toBeNull();
  });

  describe('as a resource', () => {
    const kept = (version = 3) => {
      const line = opened();

      return Line.rehydrate({
        id: line.id,
        workspaceId: line.workspaceId,
        teamId: line.teamId,
        key: line.key,
        name: line.name,
        stations: line.stations,
        reactions: line.reactions,
        version,
      });
    };

    it('says it opened', () => {
      const line = opened();

      expect(line.pullEvents()).toEqual([
        new LineOpened(
          line.id,
          line.workspaceId,
          line.teamId,
          line.key,
          ConfigurationChange.created(
            { resource: 'line', id: line.id.value, key: line.key.value },
            attributedIn(),
          ),
        ),
      ]);
    });

    it('says it was redefined when laid out again', () => {
      const line = kept();
      const relaid = line.relaidAs(
        {
          key: line.key,
          name: line.name,
          stations: line.stations,
          reactions: line.reactions,
        },
        attributedIn(),
      );

      expect(relaid.pullEvents()).toContainEqual(
        new LineRedefined(
          line.id,
          line.workspaceId,
          line.teamId,
          line.key,
          ConfigurationChange.updated(
            { resource: 'line', id: line.id.value, key: line.key.value },
            attributedIn(),
          ),
        ),
      );
    });

    it('refuses a change made against another version', () => {
      expect(() => kept(3).expecting(2)).toThrow(LineMovedOnError);
      expect(() => kept(3).expecting(3)).not.toThrow();
    });

    it('keeps its key for its whole life', () => {
      const line = kept();

      expect(() =>
        line.relaidAs(
          {
            key: LineKey.of('shipping'),
            name: line.name,
            stations: line.stations,
            reactions: line.reactions,
          },
          attributedIn(),
        ),
      ).toThrow(LineKeyFixedError);
    });

    it('retires once no task stands on it, and says so', () => {
      const line = kept();
      const retired = line.retired(new Map(), attributedIn());

      expect(retired.isRetired).toBe(true);
      expect(retired.pullEvents()).toEqual([
        new LineRetired(
          line.id,
          line.workspaceId,
          line.teamId,
          line.key,
          ConfigurationChange.deleted(
            { resource: 'line', id: line.id.value, key: line.key.value },
            attributedIn(),
          ),
        ),
      ]);
      expect(() => retired.worksIn([])).toThrow(/after it retired/);
    });

    it('will not retire while tasks stand on it, naming where', () => {
      const line = kept();
      const [, working] = line.stations;

      expect(() =>
        line.retired(new Map([[working?.id.value ?? '', 2]]), attributedIn()),
      ).toThrow(LineInUseError);
      expect(() =>
        line.retired(new Map([[working?.id.value ?? '', 2]]), attributedIn()),
      ).toThrow(`${working?.name.value} (2 standing there)`);
    });
  });
});
