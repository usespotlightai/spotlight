import { Line } from '@lines/domain/aggregates/line.aggregate';
import { Station } from '@lines/domain/entities/station.entity';
import { LineCreated } from '@lines/domain/events/line-created.event';
import { LineDeleted } from '@lines/domain/events/line-deleted.event';
import { LineUpdated } from '@lines/domain/events/line-updated.event';
import { InvalidStationLayoutError } from '@lines/domain/exceptions/invalid-station-layout.error';
import { InvalidStationSearchError } from '@lines/domain/exceptions/invalid-station-search.error';
import { LineInUseError } from '@lines/domain/exceptions/line-in-use.error';
import { LineVersionConflictError } from '@lines/domain/exceptions/line-version-conflict.error';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@lines/domain/services/built-in-lines';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

const BUILT_IN_STATIONS = BUILT_IN_LINES[0]?.stations ?? [];

import { LineRepositoryConfig } from '@lines/domain/value-objects/line-repository-config.vo';
import { Reaction } from '@lines/domain/value-objects/reaction.vo';
import { RepositorySetup } from '@lines/domain/value-objects/repository-setup.vo';
import {
  LineSearchPolicy,
  StationSearchOverride,
} from '@lines/domain/value-objects/search-policy.vo';
import { StationCheck } from '@lines/domain/value-objects/station-check.vo';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';
import { StationRoutes } from '@lines/domain/value-objects/station-routes.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
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
    routes: StationRoutes.of({
      stations: (ways.passesTo ?? []).map(StationId.of),
    }),
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
    version: 0,
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

const created = () => {
  let next = 0;
  return Line.create({
    by: changeActorIn(),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    line: BUILT_IN_LINES[0] as LineOpening,
    harness: HarnessId.of('dev'),
    newId: () => `id_${++next}`,
  });
};

const kindOf = (line: Line, kind: 'backlog' | 'completed') =>
  line.stations.find((each) => each.kind === kind) as Station;

const NO_TASKS: ReadonlyMap<string, number> = new Map();

describe('Line', () => {
  it('takes the name of the line it creates', () => {
    expect(created().name.value).toBe('Delivery');
  });

  it('starts with the stations a line is made of, left to right', () => {
    const line = created();

    expect(line.stations.map((each) => each.name.value)).toEqual(
      BUILT_IN_STATIONS.map((each) => each.name.value),
    );
    expect(line.stations.map((each) => each.position)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it('runs every work station it creates on the harness it seeds with, and the rest on none', () => {
    for (const station of created().stations) {
      expect(station.harness?.value ?? null).toBe(
        station.kind === 'work' ? 'dev' : null,
      );
    }
  });

  it('creates each station with what it is there to do', () => {
    expect(
      created().stations.filter((each) => each.kind === 'work')[0]?.agentPrompt
        ?.value,
    ).toBe(BUILT_IN_STATIONS[1]?.agentPrompt?.value);
  });

  it('gives the line and each of its stations an identity of its own', () => {
    const line = created();
    const ids = [line.id.value, ...line.stations.map((each) => each.id.value)];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('belongs to the workspace and team that created it', () => {
    const line = created();

    expect(line.workspaceId).toEqual(WorkspaceId.of('ws_1'));
    expect(line.teamId).toEqual(TeamId.of('team_1'));
  });

  describe('the backlog it always has', () => {
    it('starts with one, whoever requested it', () => {
      const line = created();

      expect(kindOf(line, 'backlog').name.value).toBe('Backlog');
      expect(kindOf(line, 'backlog').kind).toBe('backlog');
    });

    it('puts it first, where a task waits to be started', () => {
      expect(kindOf(created(), 'backlog').position).toBe(0);
    });

    it('leaves it out of the stations work moves through', () => {
      const line = created();

      expect(
        line.stations
          .filter((each) => each.kind === 'work')
          .map((each) => each.name.value),
      ).toEqual(
        BUILT_IN_STATIONS.filter((each) => each.kind === 'work').map(
          (each) => each.name.value,
        ),
      );
    });

    it('rejects a line without one', () => {
      expect(() => of([at(0)])).toThrow(InvalidStationLayoutError);
    });

    it('rejects a line with more than one', () => {
      expect(() => of([backlog(), backlog(1)])).toThrow(
        InvalidStationLayoutError,
      );
    });

    it('rejects one that is not first', () => {
      expect(() => of([at(0), backlog(1)])).toThrow(InvalidStationLayoutError);
    });
  });

  describe('the completed it always has', () => {
    it('starts with one, whoever requested it', () => {
      const line = created();

      expect(kindOf(line, 'completed').name.value).toBe('Completed');
      expect(kindOf(line, 'completed').kind).toBe('completed');
    });

    it('puts it last, where a merged task lands', () => {
      const line = created();

      expect(kindOf(line, 'completed').position).toBe(line.stations.length - 1);
    });

    it('leaves it out of the stations work moves through', () => {
      const line = created();

      expect(
        line.stations
          .filter((each) => each.kind === 'work')
          .map((each) => each.name.value),
      ).toEqual(
        BUILT_IN_STATIONS.filter((each) => each.kind === 'work').map(
          (each) => each.name.value,
        ),
      );
    });

    it('rejects a line without one', () => {
      expect(() => of([backlog(), at(1)])).toThrow(InvalidStationLayoutError);
    });

    it('rejects a line with more than one', () => {
      expect(() => of([backlog(), completed(1), completed(2)])).toThrow(
        InvalidStationLayoutError,
      );
    });

    it('rejects one that is not last', () => {
      expect(() => of([backlog(), completed(1), at(2)])).toThrow(
        InvalidStationLayoutError,
      );
    });
  });

  describe('the way work moves through it', () => {
    it('starts with the routes it is laid out with', () => {
      const line = created();
      const named = (name: string) =>
        line.stations
          .find((each) => each.name.value === name)
          ?.routes.stations.map(
            (id) => line.stationAt(id)?.name.value ?? 'nowhere',
          );

      expect(named('Backlog')).toEqual(['Triage']);
      expect(named('Triage')).toEqual(['Spec', 'Implementation']);
      expect(named('Spec')).toEqual(['Implementation']);
      expect(named('Implementation')).toEqual(['Code Review', 'Spec']);
      expect(named('Code Review')).toEqual(['Spec', 'Implementation']);
    });

    it('lets one station end the line, and no other', () => {
      const finishing = created()
        .stations.filter((each) => each.routes.ends)
        .map((each) => each.name.value);

      expect(finishing).toEqual(['Code Review']);
    });

    it('rejects a route that lands off the line', () => {
      expect(() =>
        lineOf([at(1, 'Triage', { passesTo: ['station_elsewhere'] })]),
      ).toThrow(InvalidStationLayoutError);
    });

    it('rejects a station that passes to itself', () => {
      expect(() =>
        lineOf([at(1, 'Triage', { passesTo: ['station_1'] })]),
      ).toThrow(InvalidStationLayoutError);
    });

    it('rejects a route out of the end of the line', () => {
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
            routes: StationRoutes.of({ stations: [StationId.of('station_1')] }),
          }),
        ]),
      ).toThrow(InvalidStationLayoutError);
    });
  });

  describe('what it waits for from outside', () => {
    it('rejects two stations waiting for the same word', () => {
      expect(() =>
        lineOf(
          [at(1, 'Triage'), at(2, 'Spec')],
          [sends('station_1'), sends('station_2')],
        ),
      ).toThrow(InvalidStationLayoutError);
    });

    it('rejects a rule sending a word off the line', () => {
      expect(() =>
        lineOf([at(1, 'Triage')], [sends('station_nowhere')]),
      ).toThrow(InvalidStationLayoutError);
    });
  });

  it('keeps its stations in board order however they arrive', () => {
    expect(
      lineOf([at(3), at(1), at(2)]).stations.map((e) => e.position),
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it('rejects a board with no stations at all', () => {
    expect(() => of([])).toThrow(InvalidStationLayoutError);
  });

  it('rejects a gap in the positions', () => {
    expect(() => lineOf([at(2)])).toThrow(InvalidStationLayoutError);
  });

  it('rejects two stations claiming the same place', () => {
    expect(() => lineOf([at(1), at(1)])).toThrow(InvalidStationLayoutError);
  });

  it('rejects a station before the start of the board', () => {
    expect(() => lineOf([at(-1, 'Before', { key: 'before' }), at(1)])).toThrow(
      InvalidStationLayoutError,
    );
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
});

describe('Line, what it records of its changes', () => {
  const built = () => of([backlog(), at(1, 'Build'), completed(2)]);

  it('rejects a repository with no setup on a line whose station checks its layers', () => {
    const checking = of([
      backlog(),
      Station.of({
        id: StationId.of('station_1'),
        key: StationKey.of('build'),
        name: StationName.of('Build'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        check: StationCheck.of('npm test'),
        diffs: true,
      }),
      completed(2),
    ]);

    const workingIn = (repositories: LineRepositoryConfig[]) =>
      checking.update(
        {
          key: checking.key,
          name: checking.name,
          stations: checking.stations,
          repositories,
        },
        NO_TASKS,
        changeActorIn(),
      );

    expect(() =>
      workingIn([LineRepositoryConfig.of(Repository.of('acme/api'))]),
    ).toThrow(/needs a setup for repository acme\/api/);
    expect(
      workingIn([
        LineRepositoryConfig.of(Repository.of('acme/api'), {
          setup: RepositorySetup.of('npm ci'),
        }),
      ]).repositories.entries,
    ).toHaveLength(1);
  });

  it('records nothing for a line read back as it was stored', () => {
    expect(built().pullEvents()).toEqual([]);
  });

  it('keeps the version it was read at through its changes', () => {
    const read = Line.rehydrate({
      id: LineId.of('line_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      key: LineKey.of('default'),
      name: LineName.of('Default'),
      stations: built().stations,
      version: 4,
    });

    expect(
      read.update(
        {
          key: read.key,
          name: read.name,
          stations: read.stations,
          repositories: [LineRepositoryConfig.of(Repository.of('acme/api'))],
        },
        NO_TASKS,
        changeActorIn(),
      ).version,
    ).toBe(4);
  });

  describe('as a resource', () => {
    const stored = (version = 3) => {
      const line = created();

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

    it('says it was created', () => {
      const line = created();

      expect(line.pullEvents()).toEqual([
        new LineCreated(
          line.id,
          line.workspaceId,
          line.teamId,
          line.key,
          ConfigurationChange.created(
            { resource: 'line', id: line.id.value, key: line.key.value },
            changeActorIn(),
          ),
          0,
          line.name,
          line.stations.map((each) => ({
            id: each.id,
            key: each.key,
            name: each.name,
            kind: each.kind,
            color: each.color,
            position: each.position,
          })),
        ),
      ]);
    });

    it('says it was updated when laid out again', () => {
      const line = stored();
      const updated = line.update(
        {
          key: line.key,
          name: line.name,
          stations: line.stations,
          reactions: line.reactions,
        },
        NO_TASKS,
        changeActorIn(),
      );

      expect(updated.pullEvents()).toContainEqual(
        new LineUpdated(
          line.id,
          line.workspaceId,
          line.teamId,
          line.key,
          ConfigurationChange.updated(
            { resource: 'line', id: line.id.value, key: line.key.value },
            changeActorIn(),
          ),
          line.stations.map((each) => each.id),
          4,
          line.name,
          line.stations.map((each) => ({
            id: each.id,
            key: each.key,
            name: each.name,
            kind: each.kind,
            color: each.color,
            position: each.position,
          })),
        ),
      );
    });

    it('names the stations it had and has when updated, so a removed station is told too', () => {
      const line = lineOf([at(1), at(2)]);
      const updated = line.update(
        {
          key: line.key,
          name: line.name,
          stations: [backlog(), at(1), completed(2)],
          reactions: [],
        },
        NO_TASKS,
        changeActorIn(),
      );
      const [lineUpdated] = updated
        .pullEvents()
        .filter((each) => each instanceof LineUpdated);

      expect(lineUpdated?.stationIds.map((each) => each.value).sort()).toEqual([
        'backlog_1',
        'completed_1',
        'station_1',
        'station_2',
      ]);
    });

    it('rejects a change made against another version', () => {
      expect(() => stored(3).assertVersion(2)).toThrow(
        LineVersionConflictError,
      );
      expect(() => stored(3).assertVersion(3)).not.toThrow();
    });

    it('keeps its key for its whole life', () => {
      const line = stored();

      expect(() =>
        line.update(
          {
            key: LineKey.of('shipping'),
            name: line.name,
            stations: line.stations,
            reactions: line.reactions,
          },
          NO_TASKS,
          changeActorIn(),
        ),
      ).toThrow(ImmutableFieldError);
    });

    it('will not drop a station while tasks are on it, naming where', () => {
      const line = lineOf([at(1), at(2)]);
      const dropping = (tasks: ReadonlyMap<string, number>) =>
        line.update(
          {
            key: line.key,
            name: line.name,
            stations: [backlog(), at(1), completed(2)],
            reactions: [],
          },
          tasks,
          changeActorIn(),
        );

      expect(() => dropping(new Map([['station_2', 3]]))).toThrow(
        LineInUseError,
      );
      expect(() => dropping(new Map([['station_2', 3]]))).toThrow(
        'Station 2 (3)',
      );
      expect(() => dropping(new Map([['station_1', 3]]))).not.toThrow();
    });

    it('names which stations it removes in its successor', () => {
      const line = lineOf([at(1), at(2)]);
      const next = line.update(
        {
          key: line.key,
          name: line.name,
          stations: [backlog(), at(1), completed(2)],
          reactions: [],
        },
        NO_TASKS,
        changeActorIn(),
      );

      expect(line.removedIn(next).map((each) => each.value)).toEqual([
        'station_2',
      ]);
    });

    it('is deleted once no task is on it, and says so', () => {
      const line = stored();
      const deleted = line.delete(new Map(), changeActorIn());

      expect(deleted.isDeleted).toBe(true);
      expect(deleted.pullEvents()).toEqual([
        new LineDeleted(
          line.id,
          line.workspaceId,
          line.teamId,
          line.key,
          ConfigurationChange.deleted(
            { resource: 'line', id: line.id.value, key: line.key.value },
            changeActorIn(),
          ),
          line.stations.map((each) => each.id),
          4,
          line.name,
        ),
      ]);
      expect(() => deleted.delete(new Map(), changeActorIn())).toThrow(
        /after it was deleted/,
      );
      expect(() =>
        deleted.update(
          {
            key: deleted.key,
            name: deleted.name,
            stations: deleted.stations,
          },
          NO_TASKS,
          changeActorIn(),
        ),
      ).toThrow(/after it was deleted/);
    });

    it('will not delete while tasks are on it, naming where', () => {
      const line = stored();
      const [, working] = line.stations;

      expect(() =>
        line.delete(new Map([[working?.id.value ?? '', 2]]), changeActorIn()),
      ).toThrow(LineInUseError);
      expect(() =>
        line.delete(new Map([[working?.id.value ?? '', 2]]), changeActorIn()),
      ).toThrow(`${working?.name.value} (2)`);
    });
  });
});

describe('a line’s search policy', () => {
  const searching = (
    search: LineSearchPolicy | null,
    override: StationSearchOverride | null,
  ) =>
    Line.rehydrate({
      id: LineId.of('line_search'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      key: LineKey.of('delivery'),
      name: LineName.of('Delivery'),
      search,
      version: 0,
      stations: [
        Station.of({
          id: StationId.of('station_backlog'),
          key: StationKey.of('backlog'),
          name: StationName.of('Backlog'),
          position: 0,
          color: StationColor.of('#a3a8b0'),
          kind: 'backlog',
        }),
        Station.of({
          id: StationId.of('station_build'),
          key: StationKey.of('build'),
          name: StationName.of('Build'),
          position: 1,
          color: StationColor.of('#a3a8b0'),
          search: override,
        }),
        Station.of({
          id: StationId.of('station_completed'),
          key: StationKey.of('completed'),
          name: StationName.of('Completed'),
          position: 2,
          color: StationColor.of('#a3a8b0'),
          kind: 'completed',
        }),
      ],
    });

  it('searches with the default policy when the line sets none', () => {
    expect(searching(null, null).searchPolicy).toBe(LineSearchPolicy.DEFAULT);
  });

  it('refuses a station ceiling above the line’s monthly ceiling', () => {
    expect(() =>
      searching(
        LineSearchPolicy.of({ monthlyCeiling: 20 }),
        StationSearchOverride.of({ ceiling: 25 }),
      ),
    ).toThrow(InvalidStationSearchError);
  });

  it('refuses a lowered monthly ceiling below a station ceiling it already has', () => {
    const line = searching(null, StationSearchOverride.of({ ceiling: 30 }));

    expect(() =>
      line.update(
        {
          key: line.key,
          name: line.name,
          stations: line.stations,
          search: LineSearchPolicy.of({ monthlyCeiling: 20 }),
        },
        NO_TASKS,
        changeActorIn(),
      ),
    ).toThrow(InvalidStationSearchError);
  });
});
