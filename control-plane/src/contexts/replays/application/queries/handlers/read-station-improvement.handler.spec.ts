import { ReadStationImprovementHandler } from '@replays/application/queries/handlers/read-station-improvement.handler';
import { ReadStationImprovementQuery } from '@replays/application/queries/read-station-improvement.query';
import {
  accessFor,
  FakeWork,
  InMemoryConfigPullRequests,
  InMemoryReplays,
  PERSON,
  STATION_VIEW,
} from '@replays/application/services/replays.fake-spec';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import {
  aSearch,
  aSet,
  BY,
  later,
  NOW,
  SEARCH_ID,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { beforeEach, describe, expect, it } from 'vitest';

const DAY_MS = 24 * 60 * 60 * 1000;

let memory: InMemoryReplays;
let work: FakeWork;
let pullRequests: InMemoryConfigPullRequests;

const policyOf = (enabled: boolean) =>
  SearchPolicy.of({
    enabled,
    monthlyCeiling: 50,
    currency: 'USD',
    ceiling: 10,
    periodMilliseconds: 7 * DAY_MS,
    onAlert: true,
    cooldownMilliseconds: DAY_MS,
    agent: null,
    iterations: 2,
    repeats: null,
    objective: null,
  });

const withPolicy = (enabled: boolean) => {
  const live = work.live;

  work.live = async () => ({ ...(await live()), search: policyOf(enabled) });
};

const read = (mayPlan: boolean | null = false) =>
  new ReadStationImprovementHandler(
    accessFor(memory, work, mayPlan),
    memory.setRepository,
    memory.scheduleRepository,
    memory.searchRepository,
    pullRequests,
    work,
  ).execute(
    new ReadStationImprovementQuery(
      STATION_VIEW.teamId.value,
      STATION_VIEW.lineId,
      STATION_VIEW.stationId,
      PERSON,
    ),
  );

const keptSet = async (count: number) => {
  const set = aSet(count);

  await memory.setRepository.add(set);
  await memory.scheduleRepository.add(
    StationSearchSchedule.create({
      station: set.station,
      setId: set.id,
      at: NOW,
    }).skipped('no-scoring', NOW, later(DAY_MS)),
  );

  return set;
};

beforeEach(() => {
  memory = new InMemoryReplays();
  work = new FakeWork();
  pullRequests = new InMemoryConfigPullRequests();
});

describe('ReadStationImprovementHandler', () => {
  it('reads the station as off while the live config has no search policy', async () => {
    await keptSet(3);

    expect(await read()).toMatchObject({
      status: 'off',
      setId: 'set_1',
      minimumTasks: 5,
    });
  });

  it('tells why Spotlight cannot search the kept set, with when it looks next', async () => {
    withPolicy(true);
    await keptSet(3);

    expect(await read()).toEqual({
      status: 'not-improving',
      searchId: null,
      pickPhase: null,
      pullRequestUrl: null,
      improvedAt: null,
      skip: { reason: 'no-scoring', at: NOW.toISOString() },
      pullRequestFailure: null,
      minimumTasks: 5,
      setId: 'set_1',
      lastStartedAt: null,
      checkAfter: later(DAY_MS).toISOString(),
    });
  });

  it('has not started at a station without a kept set', async () => {
    withPolicy(true);

    expect(await read()).toMatchObject({
      status: 'not-started',
      setId: null,
      checkAfter: null,
    });
  });

  it('names the search that runs at the station', async () => {
    withPolicy(true);
    const set = await keptSet(10);

    await memory.searchRepository.add(aSearch({ set }));

    expect(await read()).toMatchObject({
      status: 'searching',
      searchId: 'search_1',
    });
  });

  it('says why the newest config pull request failed', async () => {
    withPolicy(true);
    await keptSet(10);
    await pullRequests.add(
      ConfigPullRequest.pick({
        id: ConfigPullRequestId.of('pr_1'),
        searchId: SEARCH_ID,
        candidateId: CandidateId.of('candidate_1'),
        station: STATION,
        stationKey: 'build',
        candidateName: 'terse',
        lineKey: 'delivery',
        source: null,
        at: later(1),
        by: BY,
      }),
    );

    expect(await read()).toMatchObject({
      status: 'not-improving',
      skip: null,
      pullRequestFailure: { code: 'no-source' },
    });
  });

  it('refuses a caller outside the team', async () => {
    await expect(read(null)).rejects.toBeInstanceOf(ApplicationError);
  });
});
