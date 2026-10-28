import { AutoSearches } from '@replays/application/services/auto-searches.service';
import {
  FakeWork,
  IDS,
  InMemoryConfigPullRequests,
  InMemoryReplays,
  QUIET,
  refreshingFor,
  snapshotsFor,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { SetHealths } from '@replays/application/services/set-healths.service';
import { StartSearch } from '@replays/application/services/start-search.service';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import {
  aSearch,
  aSet,
  BY,
  LIVE_FINGERPRINT,
  LIVE_HASHES,
  NOW,
  STATION,
  searchRunIds,
  sha256,
  UNSCORED,
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

const auto = () =>
  new AutoSearches(
    memory.scheduleRepository,
    memory.setRepository,
    memory.searchRepository,
    pullRequests,
    refreshingFor(memory, work),
    new SetHealths(work, memory.replayRepository, memory.candidateRepository),
    new StartSearch(
      snapshotsFor(memory, work),
      memory.setRepository,
      memory.replayRepository,
      memory.searchRepository,
      memory.scheduleRepository,
      { sha256 },
      IDS,
      clock,
      TRANSACTION,
    ),
    work,
    { sha256 },
    IDS,
    clock,
    TRANSACTION,
    QUIET,
  );

const schedule = (): StationSearchSchedule => {
  const found = memory.schedules.get(STATION.stationId);

  if (!found) {
    throw new Error('the station has no search schedule');
  }

  return found;
};

const searches = (): Search[] =>
  [...memory.searches.values()].sort(
    (one, other) => one.startedAt.getTime() - other.startedAt.getTime(),
  );

const stopAll = async () => {
  for (const each of searches().filter((one) => one.isActive)) {
    await memory.searchRepository.save(each.stop(now, BY));
  }
  for (const each of memory.replays.values()) {
    if (each.isInProgress) {
      await memory.replayRepository.save(each.stop(now, BY));
    }
  }
};

const skips = () =>
  memory.events.filter((each) => each instanceof StationSearchSkipped);

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
      model: 'opus',
      effort: null,
    }),
  });

  const set = aSet(10);

  await memory.setRepository.add(set);
  await memory.scheduleRepository.add(
    StationSearchSchedule.create({
      station: STATION,
      setId: set.id,
      at: NOW,
    }),
  );
  memory.events.splice(0);
});

describe('AutoSearches', () => {
  it('starts a search on schedule with the station’s live agent and the policy’s budget, and records the tasks it searched', async () => {
    await auto().processDue();

    const [search] = searches();

    expect(search?.trigger).toBe('schedule');
    expect(search?.agent.harness).toBe('claude-code');
    expect(search?.agent.model).toBe('opus');
    expect(search?.budget.iterations).toBe(2);
    expect(search?.budget.ceiling).toEqual(Money.ceiling(10, 'USD'));
    expect(schedule().lastStartedAt).toEqual(NOW);
    expect(schedule().checkAfter).toEqual(new Date(NOW.getTime() + 3 * DAY));
    expect(
      schedule()
        .searchedTasks.map((each) => each.value)
        .sort(),
    ).toEqual(search?.split.searched.map((each) => each.taskId.value).sort());
  });

  it('searches with the agent the policy names, over the station’s own', async () => {
    policy = policyOf({
      agent: { harness: 'codex', model: null, effort: 'high' },
    });

    await auto().processDue();

    expect(searches()[0]?.agent.harness).toBe('codex');
  });

  it('starts on a station alert once the cooldown ended, before the period ends', async () => {
    await auto().processDue();
    await stopAll();

    now = new Date(NOW.getTime() + DAY);
    await memory.scheduleRepository.save(schedule().alerted(now));
    await auto().processDue();

    expect(searches()).toHaveLength(1);
    expect(schedule().lastSkip?.reason).toBe('cooldown');

    now = new Date(NOW.getTime() + 3 * DAY);
    await auto().processDue();

    expect(searches().map((each) => each.trigger)).toEqual([
      'schedule',
      'alert',
    ]);
    expect(schedule().alertPendingSince).toBeNull();
    expect(schedule().lastSkip).toBeNull();
  });

  it('skips a station whose set cannot score, at no cost, and says why once', async () => {
    scoring = UNSCORED;

    await auto().processDue();
    now = new Date(NOW.getTime() + DAY);
    await auto().processDue();

    expect(searches()).toEqual([]);
    expect(memory.candidates.size).toBe(0);
    expect(memory.replays.size).toBe(0);
    expect(schedule().lastSkip).toEqual({ reason: 'no-scoring', at: NOW });
    expect(schedule().checkAfter).toEqual(new Date(now.getTime() + DAY));
    expect(skips()).toHaveLength(1);
  });

  it('skips a set with too few tasks, and a station with no agent', async () => {
    memory.sets.clear();
    await memory.setRepository.add(aSet(4));
    await auto().processDue();

    expect(schedule().lastSkip?.reason).toBe('set-too-small');

    memory.sets.clear();
    await memory.setRepository.add(aSet(10));
    work.invalidAgent = { field: 'harness', reason: 'is unknown' };
    now = new Date(NOW.getTime() + DAY);
    await auto().processDue();

    expect(schedule().lastSkip?.reason).toBe('no-agent');
    expect(searches()).toEqual([]);
  });

  it('stops starting searches once one more could pass the monthly ceiling of the line', async () => {
    policy = policyOf({ monthlyCeiling: 10, ceiling: 10 });
    await memory.searchRepository.add(
      aSearch({ id: 'search_earlier', set: aSet(10) }).recordReplayStopReason(
        ReplayId.of('replay_seed'),
        'stopped',
        { spent: Money.of(1, 'USD'), unpriced: 0 },
        NOW,
        searchRunIds(),
        true,
      ),
    );

    await auto().processDue();

    expect(searches().map((each) => each.id)).toEqual([
      SearchId.of('search_earlier'),
    ]);
    expect(schedule().lastSkip?.reason).toBe('monthly-ceiling');
    expect(schedule().checkAfter).toEqual(
      new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 1, 1)),
    );
  });

  it('holds out only tasks no earlier search of the station searched on', async () => {
    await auto().processDue();
    await stopAll();
    now = new Date(NOW.getTime() + 7 * DAY);
    await auto().processDue();

    const [first, second] = searches();
    const searchedFirst = new Set(
      first?.split.searched.map((each) => each.taskId.value),
    );

    expect(second?.split.heldOut.length).toBeGreaterThanOrEqual(2);
    expect(
      second?.split.heldOut.some((each) =>
        searchedFirst.has(each.taskId.value),
      ),
    ).toBe(false);
  });

  it('waits for fresh held-out tasks when earlier searches searched on too many', async () => {
    await memory.scheduleRepository.save(
      schedule()
        .started({
          searched: aSet(10)
            .entries.slice(0, 8)
            .map((each) => each.taskId),
          inSet: aSet(10).entries.map((each) => each.taskId),
          at: new Date(NOW.getTime() - 30 * DAY),
          cooldownMilliseconds: 3 * DAY,
        })
        .postponed(NOW),
    );

    await auto().processDue();

    expect(searches()).toEqual([]);
    expect(schedule().lastSkip?.reason).toBe('no-fresh-held-out');
  });

  it('skips while a config pull request of the station is open, and waits while it is searched', async () => {
    await pullRequests.add(
      ConfigPullRequest.pick({
        id: ConfigPullRequestId.of('pr_1'),
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

    await auto().processDue();

    expect(schedule().lastSkip?.reason).toBe('pull-request-open');
    expect(searches()).toEqual([]);

    pullRequests.stored.clear();
    now = new Date(NOW.getTime() + DAY);
    await auto().processDue();
    await memory.scheduleRepository.save(schedule().postponed(now));
    await auto().processDue();

    expect(searches()).toHaveLength(1);
    expect(schedule().checkAfter).toEqual(
      new Date(now.getTime() + 60 * 60_000),
    );
  });

  it('skips a station whose policy is off', async () => {
    policy = policyOf({ enabled: false });

    await auto().processDue();

    expect(searches()).toEqual([]);
    expect(schedule().lastSkip?.reason).toBe('disabled');
  });

  it('leaves a schedule that changed while Spotlight looked at it due, and does not overwrite it', async () => {
    const live = work.live;

    work.live = async () => {
      await memory.scheduleRepository.save(schedule().alerted(now));
      work.live = live;
      return live();
    };
    scoring = UNSCORED;

    await auto().processDue();

    expect(schedule().lastSkip).toBeNull();
    expect(schedule().alertPendingSince).toEqual(NOW);
    expect(schedule().isDue(now)).toBe(true);
  });

  it('waits while the last search of the station still has to pick, or picked and has no pull request yet', async () => {
    const finished = aSearch({
      id: 'search_earlier',
      set: aSet(10),
    }).recordReplayStopReason(
      ReplayId.of('replay_seed'),
      'ceiling-reached',
      { spent: Money.of(1, 'USD'), unpriced: 0 },
      NOW,
      searchRunIds(),
      true,
    );

    expect(finished.awaitsPick).toBe(true);
    await memory.searchRepository.add(finished);
    await auto().processDue();

    expect(searches()).toHaveLength(1);
    expect(schedule().lastSkip).toBeNull();
    expect(schedule().checkAfter).toEqual(
      new Date(NOW.getTime() + 60 * 60_000),
    );
  });

  it('re-checks the monthly ceiling under the line lock, and skips when a search started there since it looked', async () => {
    policy = policyOf({ monthlyCeiling: 10, ceiling: 10 });
    const { ofLineStartedSince, ofStation } = memory.searchRepository;

    memory.searchRepository.ofLineStartedSince = async () => [];
    memory.searchRepository.ofStation = async () => [];
    await memory.searchRepository.add(aSearch({ id: 'search_meanwhile' }));
    await auto().processDue();
    memory.searchRepository.ofLineStartedSince = ofLineStartedSince;
    memory.searchRepository.ofStation = ofStation;

    expect(searches().map((each) => each.id)).toEqual([
      SearchId.of('search_meanwhile'),
    ]);
    expect(schedule().lastSkip?.reason).toBe('monthly-ceiling');
    expect(memory.candidates.size).toBe(0);
  });
});
