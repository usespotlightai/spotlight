import type {
  StationChangeTestOutcome,
  StationChangeTestRequest,
} from '@replays/application/contracts/station-change-tests.contract';
import { CheckSearchReadiness } from '@replays/application/services/check-search-readiness.service';
import {
  FakeSuppliers,
  IDS,
  InMemoryConfigPullRequests,
  InMemoryReplays,
  peopleWho,
  refreshingFor,
  snapshotsFor,
  stepsFor,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { SetHealths } from '@replays/application/services/set-healths.service';
import { StartSearch } from '@replays/application/services/start-search.service';
import { StationChangeTests } from '@replays/application/services/station-change-tests.service';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import {
  aSearch,
  aSet,
  BY,
  candidateOf,
  endOf,
  JUDGE,
  LIVE_FINGERPRINT,
  LIVE_HASHES,
  later,
  measuresOf,
  NOW,
  runIds,
  STATION,
  searchRunIds,
  slots,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { JudgeCalibration } from '@replays/domain/value-objects/judge-calibration';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { RubricVersion } from '@replays/domain/value-objects/rubric-version.vo';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { present } from '@shared-kernel/domain/present.fake-spec';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;

const CHECKED = CandidateScoring.of({
  checksChanges: true,
  judge: null,
  rubricVersion: null,
});

const calibrationIn = (state: 'qualified' | 'unmeasured' | 'failing') =>
  JudgeCalibration.of({
    state,
    agreement: state === 'unmeasured' ? null : 0.3,
    pairs: 12,
    minPairs: 10,
    minAgreement: 0.6,
  });

const JUDGED = CandidateScoring.of({
  checksChanges: true,
  judge: JUDGE,
  rubricVersion: RubricVersion.of('e'.repeat(64)),
});

let memory: InMemoryReplays;
let suppliers: FakeSuppliers;
let pullRequests: InMemoryConfigPullRequests;
let now: Date;
let policy: SearchPolicy;
let scoring: CandidateScoring;
let liveBlock: Record<string, unknown>;

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
    requestsPerDay: 3,
    ...over,
  });

const joinOf = (request: string) => ({
  searchId: SearchId.of('search_other'),
  request: CandidateId.of(request),
  at: now,
  requestsPerDay: 3,
});

const tests = () => {
  const healths = new SetHealths(
    suppliers.configs,
    memory.replayRepository,
    memory.candidateRepository,
  );

  return new StationChangeTests(
    suppliers.lines,
    suppliers.configs,
    peopleWho(true),
    memory.scheduleRepository,
    memory.setRepository,
    memory.searchRepository,
    memory.candidateRepository,
    pullRequests,
    refreshingFor(memory, suppliers),
    new CheckSearchReadiness(
      memory.setRepository,
      healths,
      suppliers.calibrations,
      suppliers.dispatch,
      { sha256: (text: string) => text },
      IDS,
      clock,
    ),
    new StartSearch(
      snapshotsFor(memory, suppliers),
      stepsFor(memory, suppliers, clock),
      memory.setRepository,
      memory.searchRepository,
      memory.scheduleRepository,
      memory.budgetRepository,
      { sha256: (text: string) => text },
      IDS,
      clock,
      TRANSACTION,
    ),
    snapshotsFor(memory, suppliers),
    stepsFor(memory, suppliers, clock),
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
    fields: { prompt: 'Test first.' },
    ...over,
  });

const validatedBlocks = (): unknown[] => {
  const validated: unknown[] = [];
  const validate = suppliers.configs.validate.bind(suppliers.configs);

  suppliers.configs.validate = async (...args) => {
    validated.push(args[2]);
    return validate(...args);
  };

  return validated;
};

const searches = (): Search[] => [...memory.searches.values()];

const finished = (id: string, spent: number): Search =>
  aSearch({ id, set: aSet(10) }).recordReplayEndState(
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

const verdictOf = (claimResults: readonly boolean[]) =>
  JudgeVerdict.of({
    claimResults,
    claims: [...JUDGE.claims],
    passThreshold: 1,
    model: 'judge/model',
    referenced: false,
    reasons: [],
    guidance: null,
  });

const PASSED = ChangeChecks.of([
  {
    repository: 'api',
    state: 'passed',
    skip: null,
    failedAt: [],
    spent: ModelSpent.of([], 0),
  },
]);

const judgedTwice = async (
  secondOf: (place: number) => readonly boolean[],
): Promise<void> => {
  const live = candidateOf(
    'live',
    'candidate_live',
    JUDGE,
    'npm test',
    LIVE_FINGERPRINT,
  );
  const started = Replay.start({
    id: ReplayId.of('replay_calibration'),
    set: aSet(10).snapshot,
    candidate: live.asReplayed,
    baseline: false,
    ceiling: Money.ceiling(100, 'USD'),
    at: NOW,
    by: BY,
    repeats: 2,
    calibration: true,
  });
  const reserved = started.reserving(slots(started.entries.length), runIds());
  const judged = reserved.entries.reduce((built, entry) => {
    const run = present(entry.run);

    return built
      .confirm(run, LIVE_FINGERPRINT, NOW)
      .recordRunEnd(run, endOf('completed'))
      .measure(run, measuresOf(1), later(61_000))
      .recordReview(run, PASSED, null, later(62_000))
      .recordVerdict(run, verdictOf([true, true]), later(63_000));
  }, reserved);
  const rejudged = judged.entries.reduce(
    (built, entry, place) =>
      built.recordRejudgment(present(entry.run), verdictOf(secondOf(place))),
    judged,
  );

  await memory.candidateRepository.add(live);
  await memory.replayRepository.add(rejudged);
};

beforeEach(async () => {
  memory = new InMemoryReplays();
  memory.startsPlannedReplays = true;
  suppliers = new FakeSuppliers();
  pullRequests = new InMemoryConfigPullRequests();
  now = NOW;
  policy = policyOf();
  scoring = CHECKED;
  liveBlock = { key: 'build', name: 'Build', kind: 'work' };
  suppliers.configs.live = async () => ({
    lineKey: 'delivery',
    block: StationBlock.of(liveBlock),
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
    suppliers.dispatch.invalidAgent = {
      field: 'harness',
      reason: 'is unknown',
    };

    expect(await asked()).toMatchObject({
      outcome: 'started',
      mode: 'test',
      iterations: 1,
    });

    const [search] = searches();

    expect(search.trigger).toBe('request');
    expect(search.agent).toBeNull();
    expect(search.budget.agentRuns).toBe(false);
    expect(search.requests.map((each) => each.requestedBy.value)).toEqual([
      'user_asking',
    ]);
  });

  it('refuses a search with no agent, but not a test', async () => {
    suppliers.dispatch.invalidAgent = {
      field: 'harness',
      reason: 'is unknown',
    };

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

  it('validates the change with the fields it leaves out taken from the live config', async () => {
    const validated = validatedBlocks();

    await asked({ fields: { model: 'claude-haiku-5-5' } });

    expect(validated).toEqual([
      { key: 'build', name: 'Build', kind: 'work', model: 'claude-haiku-5-5' },
    ]);
  });

  it('takes the fields a change to a running search leaves out from the starting config of the search', async () => {
    await asked({ mode: 'search' });
    liveBlock = { key: 'build', name: 'Build', kind: 'work', color: '#000000' };
    const validated = validatedBlocks();

    await asked({
      name: 'second',
      requester: UserId.of('user_other'),
      fields: { model: 'claude-haiku-5-5' },
    });

    expect(validated).toEqual([
      { key: 'build', name: 'Build', kind: 'work', model: 'claude-haiku-5-5' },
    ]);
  });

  it('refuses a change to a field a test may not change', async () => {
    expect(await asked({ fields: { color: '#000000' } })).toMatchObject({
      outcome: 'invalid',
      problems: [{ path: 'station.color' }],
    });
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
      reason: expect.stringMatching(/Minimum tasks required: \d+$/) as unknown,
    });

    memory.sets.clear();

    expect(await asked()).toMatchObject({ code: 'no-replay-set' });
  });

  it('refuses a station whose judge disagrees with people, but not one whose judge nobody checked yet', async () => {
    scoring = JUDGED;
    suppliers.insights.calibration = calibrationIn('failing');

    expect(await asked()).toMatchObject({
      outcome: 'refused',
      code: 'judge-disagrees-with-people',
      reason:
        'The verdicts of the judge of the station do not agree with the verdicts of people often enough. Spotlight cannot trust the verdicts of the judge to score a config. Please change the claims of the judge until its verdicts agree with the verdicts of people.',
    });

    suppliers.insights.calibration = calibrationIn('unmeasured');

    expect(await asked()).toMatchObject({ outcome: 'started' });
  });

  it('refuses a station whose judge disagrees with itself, with how often it agreed and the claims that changed most', async () => {
    scoring = JUDGED;
    await judgedTwice((place) => [place !== 0, place >= 5]);

    expect(await asked()).toMatchObject({
      outcome: 'refused',
      code: 'judge-unstable',
      reason:
        'The judge of the station does not give the same verdict twice for the same run. Calibration judged 20 runs twice, and the two verdicts agreed for 15 of them (75%). Spotlight needs at least 80%. The claims whose result changed most between the two verdicts: “It keeps the order of the jobs.” in 5 runs; “It drains the queue without dropping a job.” in 1 run. Please make the claims of the judge more exact.',
    });
  });

  it('refuses while a config pull request of the station is open, or the last search has not given its result', async () => {
    await pullRequests.add(
      ConfigPullRequest.pick({
        id: ConfigPullRequestId.of('pull_1'),
        searchId: SearchId.of('search_earlier'),
        candidateId: CandidateId.of('candidate_one'),
        station: STATION,
        stationKey: 'build',
        candidateName: CandidateName.rehydrate('one'),
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

    const schedule = memory.schedules.get(STATION.stationId.value);

    await memory.scheduleRepository.save(
      present(schedule)
        .requested(joinOf('a'))
        .requested(joinOf('b'))
        .requested(joinOf('c')),
    );

    expect(await asked()).toMatchObject({
      code: 'request-limit',
      reason:
        'The station took the most requested tests for today. Maximum requests a day: 3. The count resets at 2026-10-02 00:00 UTC. To allow more, set requests_per_day in the search block of the station or of the line in Terraform.',
    });
  });

  it('refuses a change to a running search after the requests of the day, and says when the count resets', async () => {
    await asked({ mode: 'search' });
    policy = policyOf({ requestsPerDay: 1 });

    expect(
      await asked({ name: 'second', requester: UserId.of('user_other') }),
    ).toEqual({
      outcome: 'refused',
      code: 'request-limit',
      reason:
        'The station took the most requested tests for today. Maximum requests a day: 1. The count resets at 2026-10-02 00:00 UTC. To allow more, set requests_per_day in the search block of the station or of the line in Terraform.',
    });
  });

  it('takes as many requests a day as the search of the station allows', async () => {
    const schedule = memory.schedules.get(STATION.stationId.value);

    await memory.scheduleRepository.save(
      present(schedule)
        .requested(joinOf('a'))
        .requested(joinOf('b'))
        .requested(joinOf('c')),
    );
    policy = policyOf({ requestsPerDay: 4 });

    expect(await asked()).toMatchObject({ outcome: 'started' });
  });

  it('ignores the cooldown of the station', async () => {
    const schedule = memory.schedules.get(STATION.stationId.value);

    await memory.scheduleRepository.save(
      present(schedule).started({
        searched: [],
        inSet: [],
        at: now,
        cooldownMilliseconds: 3 * DAY,
        requestsPerDay: 3,
        searchId: SearchId.of('search_earlier'),
        request: null,
        candidates: [],
      }),
    );

    expect(await asked()).toMatchObject({ outcome: 'started' });
  });
});
