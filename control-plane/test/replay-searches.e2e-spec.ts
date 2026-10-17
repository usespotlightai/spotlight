import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { ChangesGuardedElsewhereError } from '@replays/domain/exceptions/changes-guarded-elsewhere.error';
import { ReplaySetVersionConflictError } from '@replays/domain/exceptions/replay-set-version-conflict.error';
import { SearchCandidateNameTakenError } from '@replays/domain/exceptions/search-candidate-name-taken.error';
import { SearchUnderwayError } from '@replays/domain/exceptions/search-underway.error';
import { SearchVersionConflictError } from '@replays/domain/exceptions/search-version-conflict.error';
import {
  AT,
  aBudget,
  aSearch,
  aSet,
  BY,
  DIGESTS,
  FINGERPRINT,
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
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { DrizzleCandidateRepository } from '@replays/infrastructure/persistence/drizzle/repositories/candidate.repository';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import { DrizzleReplaySetRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-set.repository';
import { DrizzleSearchRepository } from '@replays/infrastructure/persistence/drizzle/repositories/search.repository';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

let database: TestDatabase;
let searches: DrizzleSearchRepository;
let sets: DrizzleReplaySetRepository;
let candidates: DrizzleCandidateRepository;
let replays: DrizzleReplayRepository;
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
  replays = new DrizzleReplayRepository(context, dispatcher);
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  dispatched.length = 0;
  await database.db.execute(
    'truncate replay_search, replay_set, replay_candidate, replay cascade',
  );
});

const SEED = ReplayId.of('replay_seed');

const usd = (amount: number) => Spend.of(amount, 'USD');

const charged = (amount: number) => ({ spent: usd(amount), unpriced: 0 });

const searchAt = (id: string): Search => {
  const set = ReplaySet.create({
    id: ReplaySetId.of(`set_of_${id}`),
    station: STATION,
    name: ReplaySetName.of('Searched'),
    at: NOW,
  });
  const filled = aSet(10).entries.reduce(
    (each, entry) =>
      each.withEntry(
        {
          runId: entry.runId,
          taskId: entry.taskId,
          stationId: STATION.stationId,
          unreplayableReason: null,
          reason: null,
        },
        NOW,
        false,
      ),
    set,
  );
  return aSearch({ id, set: filled });
};

const travelled = (search: Search): Search => {
  const runs = searchRunIds();

  return search
    .recordReplayEnd(SEED, 'finished', charged(5), NOW, runs, true)
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
    .recordReplayEnd(
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
    expect(found?.agent.equals(started.agent)).toBe(true);
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
      'replays.search-iteration-requested',
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
      [
        replayedAs(
          replayFor(aSet(10), 'replay_seed', 'candidate_live', null, true),
          () => 'completed',
          3,
        ),
        replayedAs(
          replayFor(
            aSet(10),
            'replay_terse',
            'candidate_terse',
            search.split.searchedRuns,
          ),
          () => 'completed',
        ),
      ],
      0.05,
      () => ReplayId.of('held_out_terse'),
      later(4),
    );
    search = search.recordReplayEnd(
      ReplayId.of('held_out_terse'),
      'over-budget',
      charged(1),
      later(5),
      runs,
      true,
    );

    await searches.add(search);

    const found = (await searches.find(SEARCH_ID)) as Search;

    expect(found.current).toBe('finished');
    expect(found.ending).toBe('iterations-spent');
    expect(found.endedAt).toEqual(later(5));
    expect(found.heldOut).toHaveLength(1);
    expect(found.heldOut[0]?.replay.end).toBe('over-budget');
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
      SearchUnderwayError,
    );

    await searches.save(first.stop(NOW, BY));
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

    await searches.save(found.stop(NOW, BY));
    await expect(searches.save(found.recordSetGone(NOW))).rejects.toThrow(
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
    digests: DIGESTS,
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

  it('rejects a second candidate of one name in one search, but not in another', async () => {
    await candidates.add(searched('candidate_a', 'terse'));

    await expect(
      candidates.add(searched('candidate_b', 'terse')),
    ).rejects.toThrow(SearchCandidateNameTakenError);

    await candidates.add(
      searched('candidate_c', 'terse', SearchId.of('search_2')),
    );
  });

  it('stores which runs a replay replays and the search it belongs to', async () => {
    const set = aSet(4);
    const started = Replay.start({
      id: ReplayId.of('replay_some'),
      set,
      candidate: searched('candidate_a', 'terse'),
      baseline: false,
      ceiling: Spend.ceiling(3, 'USD'),
      at: NOW,
      by: BY,
      among: [RunId.of('original_2'), RunId.of('original_0')],
      searchId: SEARCH_ID,
    });

    await replays.add(started);

    const found = await replays.find(ReplayId.of('replay_some'));

    expect(found?.among?.map((each) => each.value)).toEqual([
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

  it('moves a set on when a search starts on it, so a writer with an older copy is rejected', async () => {
    const set = aSet(10);

    await sets.add(set);

    const stale = (await sets.find(set.id)) as ReplaySet;

    await sets.save(((await sets.locked(set.id)) as ReplaySet).recordSearch());

    expect((await sets.find(set.id))?.version).toBe(1);
    await expect(
      sets.save(stale.withoutEntry(RunId.of('original_0'), false)),
    ).rejects.toThrow(ReplaySetVersionConflictError);
  });

  it('stores which set guards a station’s changes, one per station', async () => {
    const first = aSet(1);
    const second = ReplaySet.create({
      id: ReplaySetId.of('set_2'),
      station: STATION,
      name: ReplaySetName.of('Other'),
      at: NOW,
    });

    await sets.add(first);
    await sets.add(second);
    await sets.save(first.guardingChanges([first, second], BY));

    expect((await sets.find(first.id))?.guardsChanges).toBe(true);

    const stale = (await sets.find(second.id)) as ReplaySet;

    await expect(sets.save(stale.guardingChanges([], BY))).rejects.toThrow(
      ChangesGuardedElsewhereError,
    );
  });
});
