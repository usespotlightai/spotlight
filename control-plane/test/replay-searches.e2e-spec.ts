import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { ReplayCheckVersionConflictError } from '@replays/domain/exceptions/replay-check-version-conflict.error';
import { SearchInProgressError } from '@replays/domain/exceptions/search-in-progress.error';
import { SearchVersionConflictError } from '@replays/domain/exceptions/search-version-conflict.error';
import { StationHasReplaySetError } from '@replays/domain/exceptions/station-has-replay-set.error';
import {
  AT,
  aBudget,
  aCheck,
  aSearch,
  aSet,
  BY,
  FINGERPRINT,
  HASHES,
  LIVE_FINGERPRINT,
  later,
  NOW,
  replayedAs,
  replayFor,
  SEARCH_ID,
  STATION,
  searchRunIds,
  UNSCORED,
} from '@replays/domain/replays.fake-spec';
import { scoresOf } from '@replays/domain/services/search-scores';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { SetUsers } from '@replays/domain/value-objects/set-users.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { DrizzleReplayOutcomes } from '@replays/infrastructure/persistence/drizzle/projections/replay-outcomes.projection';
import { DrizzleCandidateRepository } from '@replays/infrastructure/persistence/drizzle/repositories/candidate.repository';
import { DrizzleReplayCheckRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-check.repository';
import { DrizzleReplaySetRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-set.repository';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import { DrizzleSearchRepository } from '@replays/infrastructure/persistence/drizzle/repositories/search.repository';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';

let database: TestDatabase;
let searches: DrizzleSearchRepository;
let sets: DrizzleReplaySetRepository;
let candidates: DrizzleCandidateRepository;
let replays: DrizzleReplayRepository;
let checks: DrizzleReplayCheckRepository;
const dispatched: DomainEvent[] = [];

beforeAll(async () => {
  database = await openDatabase('replay_searches');
  const context = new DrizzleContext(database.db);
  const dispatcher = {
    dispatch: async (events: readonly DomainEvent[]) => {
      dispatched.push(...events);
    },
  };

  searches = new DrizzleSearchRepository(context, dispatcher);
  sets = new DrizzleReplaySetRepository(context, dispatcher);
  candidates = new DrizzleCandidateRepository(context, dispatcher);
  replays = new DrizzleReplayRepository(
    context,
    dispatcher,
    new DrizzleReplayOutcomes(context),
  );
  checks = new DrizzleReplayCheckRepository(context, dispatcher);
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  dispatched.length = 0;
  await database.db.execute(
    'truncate replay_search, replay_set, replay_candidate, replay, replay_check cascade',
  );
});

const SEED = ReplayId.of('replay_seed');

const DAY_MS = 24 * 60 * 60 * 1_000;

const usd = (amount: number) => Money.of(amount, 'USD');

const charged = (amount: number) => ({ spent: usd(amount), unpriced: 0 });

const searchAt = (id: string): Search =>
  aSearch({ id, set: aSet(10, `set_of_${id}`) });

const travelled = (search: Search): Search => {
  const runs = searchRunIds();

  return search
    .recordReplayEndState(SEED, 'finished', charged(5), NOW, runs, true)
    .queueRun(RunId.of('search_run_1'))
    .acceptProposal(RunId.of('search_run_1'), {
      candidateId: CandidateId.of('candidate_terse'),
      name: CandidateName.searched('terse'),
      replayId: ReplayId.of('replay_terse'),
    })
    .proposalRejected(RunId.of('search_run_1'))
    .recordAgentSpend(
      RunId.of('search_run_1'),
      ModelSpent.of([usd(0.75)], 0),
      later(1),
      runs,
    )
    .recordRunEnd(
      RunId.of('search_run_1'),
      { failed: false, started: true },
      later(1),
      runs,
    )
    .recordReplayEndState(
      ReplayId.of('replay_terse'),
      'finished',
      charged(2.5),
      later(2),
      runs,
      true,
    );
};

describe('DrizzleSearchRepository', () => {
  it('stores a search as it was started, and as it travelled', async () => {
    const started = aSearch();

    await searches.add(started);

    expect(dispatched.map((each) => each.kind)).toEqual([]);

    const found = await searches.find(SEARCH_ID);

    expect(found?.current).toBe('seeding');
    expect(found?.split.equals(started.split)).toBe(true);
    expect(found?.budget.equals(started.budget)).toBe(true);
    expect(found?.agent).toEqual(started.agent);
    expect(found?.seed.fingerprint.equals(started.seed.fingerprint)).toBe(true);

    const moved = travelled(found as Search);

    await searches.save(moved);

    const again = (await searches.find(SEARCH_ID)) as Search;

    expect(again.version).toBe(1);
    expect(again.current).toBe('searching');
    expect(again.seed.replay.equals(moved.seed.replay)).toBe(true);
    expect(again.iterations.map((each) => each.current)).toEqual([
      'ended',
      'wanted',
    ]);
    expect(again.iterations[0]?.attempts).toBe(2);
    expect(
      again.iterations[0]?.proposals[0]?.equals(
        moved.iterations[0]?.proposals[0] as never,
      ),
    ).toBe(true);
    expect(
      again.iterations[0]?.agentSpent?.equals(
        moved.iterations[0]?.agentSpent as ModelSpent,
      ),
    ).toBe(true);
    expect(again.spent.amount).toBe(8.25);
    expect((await searches.ranAs(RunId.of('search_run_2')))?.id).toEqual(
      SEARCH_ID,
    );
    expect(await searches.ranAs(RunId.of('elsewhere'))).toBeNull();
    expect(dispatched.map((each) => each.kind)).toContain(
      'search.iteration-requested',
    );
  });

  it('stores what it held out and how it ended', async () => {
    const runs = searchRunIds();
    let search = travelled(aSearch({ budget: aBudget({ iterations: 2 }) }));

    search = search.recordRunEnd(
      RunId.of('search_run_2'),
      { failed: true, started: false },
      later(3),
      runs,
    );
    search = search.heldOutFrom(
      scoresOf(
        search,
        [
          replayedAs(
            replayFor(aSet(10), 'replay_seed', 'candidate_live', null, true),
            () => 'completed',
            3,
          ).outcome(),
          replayedAs(
            replayFor(
              aSet(10),
              'replay_terse',
              'candidate_terse',
              search.split.searchedRuns,
            ),
            () => 'completed',
          ).outcome(),
        ],
        0.05,
      ),
      () => ReplayId.of('held_out_terse'),
      later(4),
    );
    search = search.recordReplayEndState(
      ReplayId.of('held_out_terse'),
      'ceiling-reached',
      charged(1),
      later(5),
      runs,
      true,
    );

    await searches.add(search);

    const found = (await searches.find(SEARCH_ID)) as Search;

    expect(found.current).toBe('finished');
    expect(found.stopReason).toBe('iterations-spent');
    expect(found.endedAt).toEqual(later(5));
    expect(found.heldOut).toHaveLength(1);
    expect(found.heldOut[0]?.replay.end).toBe('ceiling-reached');
    expect(found.heldOut[0]?.replay.spent?.amount).toBe(1);
    expect(await searches.activeAtStation(STATION.stationId)).toBeNull();
  });

  it('allows one active search per station, and another once the first ended', async () => {
    const first = aSearch();

    await searches.add(first);

    expect((await searches.activeAtStation(STATION.stationId))?.id).toEqual(
      SEARCH_ID,
    );
    expect((await searches.activeOfSet(first.setId))?.id).toEqual(SEARCH_ID);
    await expect(searches.add(searchAt('search_2'))).rejects.toThrow(
      SearchInProgressError,
    );

    await searches.save(first.turnOff(NOW));
    await searches.add(searchAt('search_2'));

    expect((await searches.activeAtStation(STATION.stationId))?.id.value).toBe(
      'search_2',
    );
    expect(await searches.ofStation(STATION.stationId)).toHaveLength(2);
    expect(await searches.ofTeam(STATION.teamId)).toHaveLength(2);
    expect(
      await searches.findMany([SEARCH_ID, SearchId.of('search_2')]),
    ).toHaveLength(2);
  });

  it('rejects a write from a search that changed, and deletes a stopped one', async () => {
    const started = aSearch();

    await searches.add(started);

    const found = (await searches.find(SEARCH_ID)) as Search;

    await searches.save(found.turnOff(NOW));
    await expect(searches.save(found.stationLeft(NOW))).rejects.toThrow(
      SearchVersionConflictError,
    );

    const current = (await searches.locked(SEARCH_ID)) as Search;

    await searches.save(current.delete());

    expect(await searches.find(SEARCH_ID)).toBeNull();
  });
});

describe('replays, candidates and sets a search stores', () => {
  const made = {
    station: STATION,
    address: AT,
    block: StationBlock.of({ key: 'build', name: 'Build', prompt: 'Go.' }),
    fingerprint: FINGERPRINT,
    hashes: HASHES,
    scoring: UNSCORED,
    at: NOW,
  };

  const searched = (id: string, name: string, searchId = SEARCH_ID) =>
    Candidate.fromSearch({
      ...made,
      id: CandidateId.of(id),
      name,
      changedFrom: StationChanges.none(LIVE_FINGERPRINT),
      search: {
        searchId,
        iteration: 1,
        hypothesis: Hypothesis.of('Shorter keeps it on task.'),
      },
    });

  it('stores a searched candidate and a planned one with what made them', async () => {
    await candidates.add(searched('candidate_a', 'terse'));
    await candidates.add(
      Candidate.plan({
        ...made,
        id: CandidateId.of('candidate_b'),
        changedFrom: StationChanges.none(LIVE_FINGERPRINT),
        reference: PlannedReference.of({ commit: 'abcdef0', pullRequest: 7 }),
        line: null,
      }),
    );

    const [one, two] = await candidates.findMany([
      CandidateId.of('candidate_a'),
      CandidateId.of('candidate_b'),
    ]);

    expect(one?.kind).toBe('searched');
    expect(one?.search?.searchId).toEqual(SEARCH_ID);
    expect(one?.search?.iteration).toBe(1);
    expect(one?.search?.hypothesis.value).toBe('Shorter keeps it on task.');
    expect(one?.reference).toBeNull();
    expect(two?.kind).toBe('planned');
    expect(two?.name.value).toBe('Planned change, PR #7');
    expect(
      two?.reference?.equals(
        PlannedReference.of({ commit: 'abcdef0', pullRequest: 7 }),
      ),
    ).toBe(true);
    expect(two?.search).toBeNull();
  });

  it('stores which runs a replay replays and the search it belongs to', async () => {
    const set = aSet(4);
    const started = Replay.start({
      id: ReplayId.of('replay_some'),
      set: set.snapshot,
      candidate: searched('candidate_a', 'terse').asReplayed,
      baseline: false,
      ceiling: Money.ceiling(3, 'USD'),
      at: NOW,
      by: BY,
      runSubset: [RunId.of('original_2'), RunId.of('original_0')],
      searchId: SEARCH_ID,
    });

    await replays.add(started);

    const found = await replays.find(ReplayId.of('replay_some'));

    expect(found?.runSubset?.map((each) => each.value)).toEqual([
      'original_2',
      'original_0',
    ]);
    expect(found?.originals.map((each) => each.value)).toEqual([
      'original_0',
      'original_2',
    ]);
    expect(found?.searchId).toEqual(SEARCH_ID);
    expect(await replays.ofSearch(SEARCH_ID)).toHaveLength(1);
  });

  it('stores the one set kept per station and its last refresh, and finds it by when it was last refreshed', async () => {
    const kept = ReplaySet.create({
      id: ReplaySetId.of('set_1'),
      station: STATION,
      at: NOW,
    });

    await sets.add(kept);
    await expect(
      sets.add(
        ReplaySet.create({
          id: ReplaySetId.of('set_2'),
          station: STATION,
          at: NOW,
        }),
      ),
    ).rejects.toThrow(StationHasReplaySetError);
    expect(
      (await sets.atLiveStationsRefreshedBefore(NOW)).map(
        (each) => each.id.value,
      ),
    ).toEqual(['set_1']);

    await sets.save(
      kept.refresh(
        {
          add: aSet(2).entries.map((each) => ({
            runId: each.runId,
            taskId: each.taskId,
            stationId: STATION.stationId,
            unreplayableReason: null,
            reason: null,
            endedAt: NOW,
          })),
          remove: [],
        },
        NOW,
        SetUsers.none(),
      ),
    );
    const found = (await sets.ofStation(STATION.stationId)) as ReplaySet;

    expect(found.runs.map((each) => each.value)).toEqual([
      'original_0',
      'original_1',
    ]);
    expect(found.refreshedAt).toEqual(NOW);
    expect(found.lastRefresh?.at).toEqual(NOW);
    expect(found.lastRefresh?.added.map((each) => each.value)).toEqual([
      'original_0',
      'original_1',
    ]);
    expect(await sets.atLiveStationsRefreshedBefore(NOW)).toEqual([]);
    expect(
      (await sets.atLiveStationsRefreshedBefore(later(1))).map(
        (each) => each.id.value,
      ),
    ).toEqual(['set_1']);
  });

  it('finds sets refreshed the longest ago first, never refreshed before all, and none at a gone station', async () => {
    const atStation = (id: string) =>
      ReplaySet.create({
        id: ReplaySetId.of(id),
        station: { ...STATION, stationId: StationId.of(`station_${id}`) },
        at: NOW,
      });

    for (const [id, daysAgo] of [
      ['set_c', 3],
      ['set_a', null],
      ['set_d', 9],
      ['set_b', null],
    ] as const) {
      const created = atStation(id);
      await sets.add(created);
      if (daysAgo !== null) {
        await sets.save(
          created.refresh(
            { add: [], remove: [] },
            new Date(NOW.getTime() - daysAgo * DAY_MS),
            SetUsers.none(),
          ),
        );
      }
    }

    const found = async (before: Date) =>
      (await sets.atLiveStationsRefreshedBefore(before)).map(
        (each) => each.id.value,
      );

    expect(await found(NOW)).toEqual(['set_a', 'set_b', 'set_d', 'set_c']);
    expect(await found(new Date(NOW.getTime() - 5 * DAY_MS))).toEqual([
      'set_a',
      'set_b',
      'set_d',
    ]);

    const gone = (await sets.find(ReplaySetId.of('set_a'))) as ReplaySet;
    await sets.save(gone.stationLeft(NOW));

    expect(await found(NOW)).toEqual(['set_b', 'set_d', 'set_c']);
  });

  it('rejects a write from a replay check that changed, and deletes the current one', async () => {
    const set = aSet(2);
    const check = aCheck(set.id);

    await sets.add(set);
    await checks.add(check);

    const found = (await checks.find(check.id)) as ReplayCheck;

    await checks.save(found.recordBaseline());
    await expect(checks.save(found.markBaselineUnavailable())).rejects.toThrow(
      ReplayCheckVersionConflictError,
    );
    await expect(checks.save(found.delete())).rejects.toThrow(
      ReplayCheckVersionConflictError,
    );
    expect((await checks.find(check.id))?.baseline).toBe('found');

    await checks.save(((await checks.find(check.id)) as ReplayCheck).delete());

    expect(await checks.find(check.id)).toBeNull();
  });
});
