import type {
  SearchNotice,
  StationNotice,
} from '@replays/application/ports/search-notices.port';
import { NoticeSearchResults } from '@replays/application/services/notice-search-results.service';
import { PickSearchCandidates } from '@replays/application/services/pick-search-candidates.service';
import {
  CLOCK,
  FakeWork,
  IDS,
  InMemoryConfigPullRequests,
  InMemoryReplays,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { SearchSchedules } from '@replays/application/services/search-schedules.service';
import { SetHealths } from '@replays/application/services/set-healths.service';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import { ConfigPullRequestFailed } from '@replays/domain/events/config-pull-request-failed.event';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { SearchEnded } from '@replays/domain/events/search-ended.event';
import { SearchPickDeclined } from '@replays/domain/events/search-pick-declined.event';
import { StationSearchScheduleDeletionRequested } from '@replays/domain/events/station-search-schedule-deletion-requested.event';
import { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import {
  aSearch,
  aSet,
  BY,
  later,
  NOW,
  STATION,
  searchRunIds,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let memory: InMemoryReplays;
let work: FakeWork;
let pullRequests: InMemoryConfigPullRequests;
let noticed: SearchNotice[];
let advised: StationNotice[];

const notices = {
  notify: async (notice: SearchNotice) => {
    noticed.push(notice);
  },
  advise: async (notice: StationNotice) => {
    advised.push(notice);
  },
};

const noticing = () =>
  new NoticeSearchResults(memory.searchRepository, pullRequests, work, notices);

const picking = () =>
  new PickSearchCandidates(
    memory.searchRepository,
    memory.replayRepository,
    pullRequests,
    new SetHealths(work, memory.replayRepository, memory.candidateRepository),
    work,
    IDS,
    CLOCK,
    TRANSACTION,
  );

const finishedWithNothing = (): Search =>
  aSearch({ set: aSet(10) }).recordReplayStopReason(
    ReplayId.of('replay_seed'),
    'ceiling-reached',
    { spent: Money.of(1, 'USD'), unpriced: 0 },
    NOW,
    searchRunIds(),
    true,
  );

const ended = (search: Search, state: 'finished' | 'stopped') =>
  new SearchEnded(
    search.id,
    search.workspaceId,
    state,
    search.stopReason ?? 'stopped',
    null,
    [],
  );

const pullRequestOf = (search: Search, source = true) =>
  ConfigPullRequest.pick({
    id: ConfigPullRequestId.of('pr_1'),
    searchId: search.id,
    candidateId: CandidateId.of('candidate_one'),
    station: STATION,
    stationKey: 'build',
    candidateName: 'one',
    lineKey: 'delivery',
    source: source
      ? {
          repository: Repository.of('acme/platform'),
          path: 'teams/core/delivery.tf',
        }
      : null,
    at: NOW,
    by: BY,
  });

beforeEach(() => {
  memory = new InMemoryReplays();
  work = new FakeWork();
  pullRequests = new InMemoryConfigPullRequests();
  noticed = [];
  advised = [];
});

describe('PickSearchCandidates', () => {
  it('declines a finished search with no held-out candidate, once, and says why to the team', async () => {
    const search = finishedWithNothing();

    expect(search.current).toBe('finished');
    await memory.searchRepository.add(search);
    memory.events.splice(0);

    await picking().searchEnded(ended(search, 'finished'));
    await picking().searchEnded(ended(search, 'finished'));

    const declined = memory.events.filter(
      (each) => each instanceof SearchPickDeclined,
    ) as SearchPickDeclined[];

    expect(memory.searches.get(search.id.value)?.pick).toEqual({
      outcome: 'declined',
      reason: 'no-candidate',
    });
    expect(declined).toHaveLength(1);

    await noticing().pickDeclined(declined[0] as SearchPickDeclined);

    expect(noticed).toEqual([
      {
        workspaceId: STATION.workspaceId,
        teamId: STATION.teamId,
        searchId: search.id,
        lineId: STATION.lineId,
        stationId: STATION.stationId,
        about: 'result',
        headline: 'The search of the Build station ended with no pull request',
        points: ['No candidate finished its replay on the held-out tasks.'],
      },
    ]);
  });

  it('declines a finished search whose station is gone from its line', async () => {
    const search = finishedWithNothing();

    await memory.searchRepository.add(search);
    work.station = async () => null;
    await picking().searchEnded(ended(search, 'finished'));

    expect(memory.searches.get(search.id.value)?.pick).toEqual({
      outcome: 'declined',
      reason: 'station-gone',
    });
  });

  it('picks nothing for a stopped search', async () => {
    const search = aSearch({ set: aSet(10) }).stop(NOW, BY);

    await memory.searchRepository.add(search);
    memory.events.splice(0);
    await picking().searchEnded(ended(search, 'stopped'));

    expect(memory.searches.get(search.id.value)?.pick).toBeNull();
    expect(memory.events).toEqual([]);
  });
});

describe('NoticeSearchResults', () => {
  it('tells the team once the config pull request opened, with its link', async () => {
    const search = finishedWithNothing();
    const opening = pullRequestOf(search);

    await memory.searchRepository.add(search);
    await pullRequests.add(opening);

    const url = PullRequestUrl.of('https://github.com/acme/platform/pull/7');

    await noticing().pullRequestOpened(
      new ConfigPullRequestOpened(
        opening.id,
        STATION.workspaceId,
        STATION.teamId,
        STATION.stationId,
        StationFingerprint.of('e'.repeat(64)),
        url,
        later(5),
      ),
    );

    expect(noticed).toEqual([
      expect.objectContaining({
        about: 'result',
        headline:
          'Spotlight opened a config pull request for the Build station',
        points: [
          'Candidate one did better than the live config on the held-out tasks.',
          'Pull request: https://github.com/acme/platform/pull/7',
          'Please review the pull request. The station changes when you merge it.',
        ],
      }),
    ]);
  });

  it('tells the team when the config pull request could not be opened, with the reason', async () => {
    const search = finishedWithNothing();
    const failed = pullRequestOf(search, false);

    await memory.searchRepository.add(search);
    await pullRequests.add(failed);
    await noticing().pullRequestFailed(
      new ConfigPullRequestFailed(
        failed.id,
        STATION.workspaceId,
        failed.reason as ConfigPullRequestReason,
      ),
    );

    expect(noticed).toEqual([
      expect.objectContaining({
        headline:
          'Sorry, the config pull request for the Build station could not be opened',
        points: [
          'Candidate one did better than the live config on the held-out tasks.',
          'Reason: Line delivery has no Terraform source. Please add a source block with repository and path to spotlight_line.',
        ],
      }),
    ]);
  });

  it('advises the team only on the skips a person can fix', async () => {
    const skipped = (reason: StationSearchSkipped['reason']) =>
      new StationSearchSkipped(
        STATION.workspaceId,
        STATION.teamId,
        STATION.lineId,
        STATION.stationId,
        reason,
        NOW,
      );

    for (const reason of [
      'no-scoring',
      'set-too-small',
      'no-headroom',
      'cooldown',
      'monthly-ceiling',
      'pull-request-open',
      'ceiling-too-low',
      'no-agent',
    ] as const) {
      await noticing().skipped(skipped(reason));
    }

    expect(advised.map((each) => each.about)).toEqual([
      `no-scoring ${NOW.toISOString()}`,
      `set-too-small ${NOW.toISOString()}`,
      `no-headroom ${NOW.toISOString()}`,
      `ceiling-too-low ${NOW.toISOString()}`,
      `no-agent ${NOW.toISOString()}`,
    ]);
    expect(advised[0]).toMatchObject({
      headline: 'Spotlight cannot search the Build station',
      points: [
        'The station has no judge and no check. Spotlight cannot score a config without one of them.',
        'Please add a judge or a check to the station in the Terraform of the line.',
      ],
    });
  });
});

describe('SearchSchedules', () => {
  const schedules = () =>
    new SearchSchedules(memory.scheduleRepository, TRANSACTION, CLOCK);

  beforeEach(async () => {
    await memory.scheduleRepository.add(
      StationSearchSchedule.create({
        station: STATION,
        setId: aSet().id,
        at: later(60_000),
      }).postponed(later(60_000)),
    );
  });

  it('looks again at once at the stations of a line that changed', async () => {
    await schedules().lineChanged('line_other');

    expect(memory.schedules.get(STATION.stationId)?.isDue(NOW)).toBe(false);

    await schedules().lineChanged(STATION.lineId);

    expect(memory.schedules.get(STATION.stationId)?.checkAfter).toEqual(NOW);
  });

  it('looks at a station at once when its alert fires', async () => {
    await schedules().alerted(STATION.stationId);

    expect(memory.schedules.get(STATION.stationId)).toMatchObject({
      alertPendingSince: NOW,
      checkAfter: NOW,
    });
  });

  it('drops the schedule with its set, and asks to drop each of a deleted team', async () => {
    expect(
      await schedules().deleteForTeam(STATION.teamId, STATION.workspaceId),
    ).toEqual([
      new StationSearchScheduleDeletionRequested(
        STATION.stationId,
        STATION.workspaceId,
      ),
    ]);

    await schedules().setGone(aSet().id);

    expect(memory.schedules.size).toBe(0);
  });
});
