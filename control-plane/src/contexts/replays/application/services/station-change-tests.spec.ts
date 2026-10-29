import { CheckSearchReadiness } from '@replays/application/services/check-search-readiness.service';
import {
  FakeWork,
  IDS,
  InMemoryConfigPullRequests,
  InMemoryReplays,
  peopleWho,
  refreshingFor,
  snapshotsFor,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { SetHealths } from '@replays/application/services/set-healths.service';
import { StartSearch } from '@replays/application/services/start-search.service';
import { StationChangeTests } from '@replays/application/services/station-change-tests.service';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import {
  aSearch,
  aSet,
  BY,
  LIVE_FINGERPRINT,
  LIVE_HASHES,
  NOW,
  STATION,
  searchRunIds,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  StationChangeTestOutcome,
  StationChangeTestRequest,
} from '@work/application/ports/station-change-tests.port';
import { beforeEach, describe, expect, it } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;

const CHECKED = CandidateScoring.of({
  checksChanges: true,
  judge: null,
  rubricVersion: null,
});

let memory: InMemoryReplays;
let work: FakeWork;
let pullRequests: InMemoryConfigPullRequests;
let now: Date;
let policy: SearchPolicy;
let scoring: CandidateScoring;

const clock: ClockPort = { now: () => now, sleep: async () => {} };

const policyOf = (over: Partial<Parameters<typeof SearchPolicy.of>[0]> = {}) =>
  SearchPolicy.of({
    enabled: true,
    monthlyCeiling: 50,
    currency: 'USD',
    ceiling: 10,
    periodMilliseconds: 7 * DAY,
    onAlert: true,
    cooldownMilliseconds: 3 * DAY,
    agent: null,
    iterations: 2,
    repeats: null,
    objective: null,
    ...over,
  });

const tests = () => {
  const healths = new SetHealths(
    work,
    memory.replayRepository,
    memory.candidateRepository,
  );

  return new StationChangeTests(
    work,
    peopleWho(true),
    memory.scheduleRepository,
    memory.setRepository,
    memory.searchRepository,
    memory.candidateRepository,
    pullRequests,
    new CheckSearchReadiness(
      refreshingFor(memory, work),
      memory.setRepository,
      healths,
      work,
      { sha256: (text: string) => text },
      IDS,
      clock,
    ),
    new StartSearch(
      snapshotsFor(memory, work),
      memory.setRepository,
      memory.replayRepository,
      memory.candidateRepository,
      memory.searchRepository,
      memory.scheduleRepository,
      { sha256: (text: string) => text },
      IDS,
      clock,
      TRANSACTION,
    ),
    IDS,
    clock,
    TRANSACTION,
  );
};

const asked = (
  over: Partial<StationChangeTestRequest> = {},
): Promise<StationChangeTestOutcome> =>
  tests().request({
    workspaceId: STATION.workspaceId,
    teamId: STATION.teamId,
    lineId: STATION.lineId,
    stationId: STATION.stationId,
    requester: UserId.of('user_asking'),
    mode: 'test',
    name: 'shorter-prompt',
    hypothesis: 'Fewer missed tests.',
    block: { key: 'build', name: 'Build', kind: 'work', prompt: 'Test first.' },
    ...over,
  });

const searches = (): Search[] => [...memory.searches.values()];

const finished = (id: string, spent: number): Search =>
  aSearch({ id, set: aSet(10) }).recordReplayStopReason(
    ReplayId.of('replay_seed'),
    'ceiling-reached',
    { spent: Money.of(spent, 'USD'), unpriced: 0 },
    NOW,
    searchRunIds(),
    true,
  );

const withSet = async (set: ReplaySet) => {
  memory.sets.clear();
  await memory.setRepository.add(set);
};

beforeEach(async () => {
  memory = new InMemoryReplays();
  work = new FakeWork();
  pullRequests = new InMemoryConfigPullRequests();
  now = NOW;
  policy = policyOf();
  scoring = CHECKED;
  work.live = async () => ({
    lineKey: 'delivery',
    block: StationBlock.of({ key: 'build', name: 'Build', kind: 'work' }),
    fingerprint: LIVE_FINGERPRINT,
    scoring,
    hashes: LIVE_HASHES,
    threshold: null,
    search: policy,
    agent: SearchAgent.of({
      harness: 'claude-code',
      model: null,
      effort: null,
    }),
  });

  const set = aSet(10);

  await memory.setRepository.add(set);
  await memory.scheduleRepository.add(
    StationSearchSchedule.create({ station: STATION, setId: set.id, at: NOW }),
  );
});

describe('StationChangeTests', () => {
  it('starts a one-iteration test with no search agent, asked for by the person', async () => {
    work.invalidAgent = { field: 'harness', reason: 'is unknown' };

    expect(await asked()).toMatchObject({
      outcome: 'started',
      mode: 'test',
      iterations: 1,
    });

    const [search] = searches();

    expect(search?.trigger).toBe('request');
    expect(search?.agent).toBeNull();
    expect(search?.budget.agentRuns).toBe(false);
    expect(search?.requests.map((each) => each.requestedBy.value)).toEqual([
      'user_asking',
    ]);
  });

  it('refuses a search with no agent, but not a test', async () => {
    work.invalidAgent = { field: 'harness', reason: 'is unknown' };

    expect(await asked({ mode: 'search' })).toMatchObject({
      outcome: 'refused',
      code: 'no-agent',
    });
  });

  it('answers a retry of the same change by the same person with the earlier answer', async () => {
    const first = await asked();
    const again = await asked();

    expect(again).toEqual(first);
    expect(searches()).toHaveLength(1);
    expect(searches()[0]?.requests).toHaveLength(1);
  });

  it('adds a change to a running search, and refuses a name another candidate has', async () => {
    await asked({ mode: 'search' });

    expect(await asked({ requester: UserId.of('user_other') })).toEqual({
      outcome: 'invalid',
      problems: [
        {
          path: 'name',
          reason: 'names another candidate of the running search already',
        },
      ],
    });
    expect(
      await asked({ name: 'second', requester: UserId.of('user_other') }),
    ).toMatchObject({ outcome: 'joined', iteration: 1, iterations: 2 });
  });

  it('checks search off before anything else', async () => {
    policy = policyOf({ enabled: false });
    memory.sets.clear();

    expect(await asked()).toMatchObject({ code: 'search-off' });
  });

  it('refuses a station with no replay set, no scoring, or too few tasks', async () => {
    scoring = CandidateScoring.of({
      checksChanges: false,
      judge: null,
      rubricVersion: null,
    });

    expect(await asked()).toMatchObject({ code: 'no-scoring' });

    scoring = CHECKED;
    await withSet(aSet(4));

    expect(await asked()).toMatchObject({
      code: 'set-too-small',
      reason: expect.stringMatching(/Minimum tasks required: \d+$/),
    });

    memory.sets.clear();

    expect(await asked()).toMatchObject({ code: 'no-replay-set' });
  });

  it('refuses while a config pull request of the station is open, or the last search has not given its result', async () => {
    await pullRequests.add(
      ConfigPullRequest.pick({
        id: ConfigPullRequestId.of('pull_1'),
        searchId: SearchId.of('search_earlier'),
        candidateId: CandidateId.of('candidate_one'),
        station: STATION,
        stationKey: 'build',
        candidateName: 'one',
        lineKey: 'delivery',
        source: {
          repository: Repository.of('acme/platform'),
          path: 'teams/core/delivery.tf',
        },
        at: NOW,
        by: BY,
      }),
    );

    expect(await asked()).toMatchObject({ code: 'pull-request-open' });

    pullRequests.stored.clear();
    await memory.searchRepository.add(finished('search_earlier', 0));

    expect(await asked()).toMatchObject({ code: 'result-pending' });
  });

  it('refuses once one more search could pass the monthly ceiling, and after 3 requests a day', async () => {
    policy = policyOf({ monthlyCeiling: 10, ceiling: 10 });
    await memory.searchRepository.add(
      finished('search_spent', 5).picked({
        outcome: 'declined',
        reason: 'no-candidate',
      }),
    );

    expect(await asked()).toMatchObject({ code: 'monthly-ceiling' });

    memory.searches.clear();
    policy = policyOf();

    const schedule = memory.schedules.get(STATION.stationId);

    await memory.scheduleRepository.save(
      (schedule as StationSearchSchedule)
        .requested(now)
        .requested(now)
        .requested(now),
    );

    expect(await asked()).toMatchObject({
      code: 'request-limit',
      reason: expect.stringMatching(/Maximum requests a day: 3$/),
    });
  });

  it('ignores the cooldown of the station', async () => {
    const schedule = memory.schedules.get(STATION.stationId);

    await memory.scheduleRepository.save(
      (schedule as StationSearchSchedule).started({
        searched: [],
        inSet: [],
        at: now,
        cooldownMilliseconds: 3 * DAY,
        trigger: 'schedule',
      }),
    );

    expect(await asked()).toMatchObject({ outcome: 'started' });
  });
});
