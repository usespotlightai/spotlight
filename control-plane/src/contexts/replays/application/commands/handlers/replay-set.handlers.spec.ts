import { RemoveReplaySetEntryHandler } from '@replays/application/commands/handlers/remove-replay-set-entry.handler';
import { RemoveReplaySetEntryCommand } from '@replays/application/commands/remove-replay-set-entry.command';
import { KeepReplaySets } from '@replays/application/services/keep-replay-sets.service';
import { RefreshKeptSets } from '@replays/application/services/refresh-kept-sets.service';
import {
  accessFor,
  CLOCK,
  FakeInsights,
  FakeWork,
  IDS,
  InMemoryChecks,
  InMemoryReplays,
  PERSON,
  peopleWho,
  QUIET,
  STATION_VIEW,
  TRANSACTION,
  usageFor,
} from '@replays/application/services/replays.fake-spec';
import {
  KEPT_SET_SIZE,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import {
  aCheck,
  aReplay,
  aSearch,
  aSet,
  BY,
  NOW,
  SEARCH_ID,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { refreshCutoff } from '@replays/domain/services/kept-set-refresh';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let memory: InMemoryReplays;
let work: FakeWork;
let insights: FakeInsights;
let checks: InMemoryChecks;

const DAY_MS = 24 * 60 * 60 * 1_000;

const errorOf = async (call: Promise<unknown>) =>
  call.then(
    () => {
      throw new Error('it was allowed');
    },
    (error: unknown) => {
      if (error instanceof ApplicationError) {
        return error.kind;
      }
      throw error;
    },
  );

const recent = (run: string, task = `task_of_${run}`) => ({
  runId: RunId.of(run),
  taskId: TaskId.of(task),
  stationId: STATION.stationId,
  unreplayableReason: null,
  reason: null,
  title: `Title of ${run}`,
  state: 'completed',
  endedAt: NOW,
  origin: null,
});

const removing = () =>
  new RemoveReplaySetEntryHandler(
    accessFor(memory, work),
    memory.setRepository,
    usageFor(memory, checks),
    TRANSACTION,
  );

const keeping = (people = peopleWho(true)) =>
  new KeepReplaySets(memory.setRepository, work, people, IDS, CLOCK);

const refreshing = () =>
  new RefreshKeptSets(
    memory.setRepository,
    usageFor(memory, checks),
    work,
    insights,
    CLOCK,
    TRANSACTION,
    QUIET,
  );

const runsOfSet = () =>
  memory.sets.get('set_1')?.runs.map((each) => each.value);

const stateOf = (set: ReplaySet) => ({
  id: set.id,
  station: set.station,
  entries: set.entries,
  removedTasks: set.removedTasks,
  createdAt: set.createdAt,
  refreshedAt: set.refreshedAt,
  lastRefresh: set.lastRefresh,
  stationGoneAt: set.stationGoneAt,
  version: set.version,
});

const unrefreshed = (refreshedAt: Date | null = null) =>
  ReplaySet.rehydrate({
    id: ReplaySetId.of('set_1'),
    station: STATION,
    entries: [],
    removedTasks: [],
    createdAt: NOW,
    refreshedAt,
    lastRefresh: null,
    stationGoneAt: null,
    version: 0,
  });

beforeEach(() => {
  memory = new InMemoryReplays();
  work = new FakeWork();
  insights = new FakeInsights();
  checks = new InMemoryChecks(memory.events);
});

describe('RemoveReplaySetEntryHandler', () => {
  it('takes a run out of a set, and its task never comes back', async () => {
    await memory.setRepository.add(aSet(2));
    work.recent = [recent('newer_of_task_0', 'task_0')];

    await removing().execute(
      new RemoveReplaySetEntryCommand('team_1', 'set_1', 'original_0', PERSON),
    );
    await refreshing().refreshBefore(ReplaySetId.of('set_1'));

    expect(runsOfSet()).toEqual(['original_1']);
    expect(
      memory.sets.get('set_1')?.removedTasks.map((each) => each.value),
    ).toEqual(['task_0']);
  });

  it('denies one who may read the team but not plan', async () => {
    await memory.setRepository.add(aSet(2));

    expect(
      await new RemoveReplaySetEntryHandler(
        accessFor(memory, work, false),
        memory.setRepository,
        usageFor(memory, checks),
        TRANSACTION,
      ).execute(
        new RemoveReplaySetEntryCommand(
          'team_1',
          'set_1',
          'original_0',
          PERSON,
        ),
      ),
    ).toEqual({ outcome: 'forbidden', act: 'plan' });
  });

  it('lets no run go while a replay of the set is in progress', async () => {
    await memory.setRepository.add(aSet(2));
    await memory.replayRepository.add(aReplay({ count: 2 }));

    expect(
      await errorOf(
        removing().execute(
          new RemoveReplaySetEntryCommand(
            'team_1',
            'set_1',
            'original_0',
            PERSON,
          ),
        ),
      ),
    ).toBe('conflict');
    expect(runsOfSet()).toEqual(['original_0', 'original_1']);
  });

  it('lets no run go while a check of the set waits for its baseline', async () => {
    await memory.setRepository.add(aSet(2));
    await checks.add(aCheck());

    expect(
      await errorOf(
        removing().execute(
          new RemoveReplaySetEntryCommand(
            'team_1',
            'set_1',
            'original_0',
            PERSON,
          ),
        ),
      ),
    ).toBe('conflict');
  });

  it('lets no run go while a search uses the set', async () => {
    const set = aSet(10);
    await memory.setRepository.add(set);
    await memory.searchRepository.add(aSearch({ set }));

    expect(
      await errorOf(
        removing().execute(
          new RemoveReplaySetEntryCommand(
            'team_1',
            'set_1',
            'original_0',
            PERSON,
          ),
        ),
      ),
    ).toBe('conflict');
  });
});

describe('KeepReplaySets', () => {
  it('keeps an empty set for a station once a run of it ends', async () => {
    await keeping().onRunEnded(STATION.stationId, STATION.workspaceId);

    const [kept] = memory.sets.values();

    expect(kept?.station).toEqual({
      workspaceId: STATION_VIEW.workspaceId,
      teamId: STATION_VIEW.teamId,
      lineId: STATION_VIEW.lineId,
      stationId: STATION_VIEW.stationId,
    });
    expect(kept?.entries).toEqual([]);
    expect(kept?.refreshedAt).toBeNull();
  });

  it('keeps one set for a station, however many of its runs end', async () => {
    await keeping().onRunEnded(STATION.stationId, STATION.workspaceId);
    await keeping().onRunEnded(STATION.stationId, STATION.workspaceId);

    expect(memory.sets.size).toBe(1);
  });

  it('keeps no set for a run without a station, at a station Work does not know, or in another workspace', async () => {
    await keeping().onRunEnded(null, STATION.workspaceId);
    await keeping().onRunEnded('station_gone', STATION.workspaceId);
    await keeping().onRunEnded(STATION.stationId, WorkspaceId.of('elsewhere'));

    expect(memory.sets.size).toBe(0);
  });

  it('keeps no set for a station whose team is gone', async () => {
    await keeping({
      ...peopleWho(true),
      teamKey: async () => null,
    }).onRunEnded(STATION.stationId, STATION.workspaceId);

    expect(memory.sets.size).toBe(0);
  });
});

describe('RefreshKeptSets', () => {
  it('fills a set that was never refreshed from its station’s recent runs', async () => {
    await memory.setRepository.add(unrefreshed());
    work.recent = [recent('run_2'), recent('run_1')];

    await refreshing().processDue();

    const set = memory.sets.get('set_1');

    expect(runsOfSet()).toEqual(['run_2', 'run_1']);
    expect(set?.refreshedAt).toEqual(NOW);
    expect(set?.lastRefresh?.added.map((each) => each.value)).toEqual([
      'run_2',
      'run_1',
    ]);
    expect(memory.events).toEqual([
      new ReplaySetEntriesChanged(ReplaySetId.of('set_1'), STATION.workspaceId),
    ]);
  });

  it('leaves a full set refreshed in the last 7 days, and refreshes an older one', async () => {
    work.recent = [recent('run_1')];
    await memory.setRepository.add(
      ReplaySet.rehydrate({
        ...stateOf(aSet(KEPT_SET_SIZE)),
        refreshedAt: new Date(NOW.getTime() - 6 * DAY_MS),
      }),
    );

    await refreshing().processDue();

    expect(runsOfSet()).toHaveLength(KEPT_SET_SIZE);
    expect(memory.sets.get('set_1')?.refreshedAt).toEqual(
      new Date(NOW.getTime() - 6 * DAY_MS),
    );
  });

  it('refreshes a set that is not full a day after its last refresh', async () => {
    work.recent = [recent('run_1')];
    await memory.setRepository.add(unrefreshed(NOW));

    await refreshing().processDue();

    expect(runsOfSet()).toEqual([]);

    await memory.setRepository.save(
      unrefreshed(new Date(NOW.getTime() - 2 * DAY_MS)),
    );
    await refreshing().processDue();

    expect(runsOfSet()).toEqual(['run_1']);
  });

  it('leaves a set another tick refreshed since it was found due', async () => {
    const fresh = unrefreshed(NOW);
    await memory.setRepository.add(fresh);
    work.recent = [recent('run_1')];
    const repository = {
      ...memory.setRepository,
      dueForRefresh: async () => [fresh],
    };

    await new RefreshKeptSets(
      repository,
      usageFor(memory, checks),
      work,
      insights,
      CLOCK,
      TRANSACTION,
      QUIET,
    ).processDue();

    expect(runsOfSet()).toEqual([]);
  });

  it('skips a set a search uses, and refreshes it on a later tick', async () => {
    const set = unrefreshed();
    await memory.setRepository.add(set);
    await memory.searchRepository.add(aSearch({ set: aSet(10) }));
    work.recent = [recent('run_1')];

    await refreshing().processDue();

    expect(runsOfSet()).toEqual([]);
    expect(memory.sets.get('set_1')?.refreshedAt).toBeNull();

    const search = await memory.searchRepository.find(SEARCH_ID);
    await memory.searchRepository.save(
      search?.stop(NOW, BY) ?? expect.unreachable(),
    );
    await refreshing().processDue();

    expect(runsOfSet()).toEqual(['run_1']);
  });

  it('does not refresh before a search while a replay of the set is in progress', async () => {
    await memory.setRepository.add(unrefreshed());
    await memory.replayRepository.add(aReplay({ count: 1 }));
    work.recent = [recent('run_1')];

    expect(await refreshing().refreshBefore(ReplaySetId.of('set_1'))).toBe(
      false,
    );
    expect(runsOfSet()).toEqual([]);
  });

  it('does not refresh a set while a check of it waits for its baseline', async () => {
    await memory.setRepository.add(unrefreshed());
    await checks.add(aCheck());
    work.recent = [recent('run_1')];

    await refreshing().processDue();

    expect(runsOfSet()).toEqual([]);
  });

  it('refreshes the sets that waited longest first, so none starves', async () => {
    for (const [id, days] of [
      ['set_c', 3],
      ['set_a', null],
      ['set_b', 5],
    ] as const) {
      await memory.setRepository.add(
        ReplaySet.rehydrate({
          ...stateOf(unrefreshed()),
          id: ReplaySetId.of(id),
          station: { ...STATION, stationId: `station_${id}` },
          refreshedAt:
            days === null ? null : new Date(NOW.getTime() - days * DAY_MS),
        }),
      );
    }

    const due = await memory.setRepository.dueForRefresh(refreshCutoff(NOW), 2);

    expect(due.map((each) => each.id.value)).toEqual(['set_a', 'set_b']);
  });

  it('refreshes before a search, whenever it was last refreshed', async () => {
    await memory.setRepository.add(unrefreshed(NOW));
    work.recent = [recent('run_1')];

    expect(await refreshing().refreshBefore(ReplaySetId.of('set_1'))).toBe(
      true,
    );
    expect(runsOfSet()).toEqual(['run_1']);
  });

  it('refreshes no set whose station is gone', async () => {
    await memory.setRepository.add(unrefreshed().stationLeft(NOW));
    work.recent = [recent('run_1')];

    await refreshing().processDue();

    expect(await refreshing().refreshBefore(ReplaySetId.of('set_1'))).toBe(
      false,
    );
    expect(runsOfSet()).toEqual([]);
  });
});
