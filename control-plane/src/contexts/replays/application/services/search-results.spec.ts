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
import { SearchFindings } from '@replays/application/services/search-findings.service';
import { SearchSchedules } from '@replays/application/services/search-schedules.service';
import { SetHealths } from '@replays/application/services/set-healths.service';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import { ConfigPullRequestFailed } from '@replays/domain/events/config-pull-request-failed.event';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { SearchCandidatePicked } from '@replays/domain/events/search-candidate-picked.event';
import { SearchEnded } from '@replays/domain/events/search-ended.event';
import { SearchPickDeclined } from '@replays/domain/events/search-pick-declined.event';
import { StationSearchScheduleDeletionRequested } from '@replays/domain/events/station-search-schedule-deletion-requested.event';
import { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import {
  aSearch,
  aSet,
  BY,
  candidateOf,
  later,
  NOW,
  STATION,
  searchRunIds,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { SEARCH_SKIP_REASONS } from '@replays/domain/value-objects/search-skip-reason';
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
  new NoticeSearchResults(
    memory.searchRepository,
    pullRequests,
    memory.candidateRepository,
    memory.replayRepository,
    new SetHealths(work, memory.replayRepository, memory.candidateRepository),
    new SearchFindings(work),
    work,
    notices,
  );

const picking = () =>
  new PickSearchCandidates(
    memory.searchRepository,
    memory.replayRepository,
    pullRequests,
    memory.candidateRepository,
    memory.scheduleRepository,
    new SetHealths(work, memory.replayRepository, memory.candidateRepository),
    work,
    IDS,
    CLOCK,
    TRANSACTION,
  );

const finishedWithNothing = (requestedBy?: string): Search =>
  aSearch({
    set: aSet(10),
    ...(requestedBy ? { requestedBy } : {}),
  }).recordReplayStopReason(
    ReplayId.of('replay_seed'),
    'ceiling-reached',
    { spent: Money.of(1, 'USD'), unpriced: 0 },
    NOW,
    searchRunIds(),
    true,
  );

const withOtherCandidate = (): Search => {
  const runIds = searchRunIds();
  const taken = aSearch({ set: aSet(10), requestedBy: 'user_asking' })
    .recordReplayStopReason(
      ReplayId.of('replay_seed'),
      'finished',
      { spent: Money.of(1, 'USD'), unpriced: 0 },
      NOW,
      runIds,
      true,
    )
    .requestsTaken(() => ReplayId.of('replay_asked'), NOW, runIds)
    .recordReplayStopReason(
      ReplayId.of('replay_asked'),
      'finished',
      { spent: Money.of(1, 'USD'), unpriced: 0 },
      NOW,
      runIds,
      false,
    );
  const run = taken.activeRun;

  if (!run) {
    throw new Error('the search wants no agent iteration');
  }

  return taken.acceptProposal(run, {
    candidateId: CandidateId.of('candidate_other'),
    name: CandidateName.searched('other'),
    replayId: ReplayId.of('replay_other'),
  });
};

const ended = (search: Search, state: 'finished' | 'stopped') =>
  new SearchEnded(
    search.id,
    search.workspaceId,
    state,
    search.stopReason ?? 'turned-off',
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
  it('declines a finished search with no held-out candidate, once, and tells nobody', async () => {
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

    expect(noticed).toEqual([]);
    expect(advised).toEqual([]);
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
    const search = aSearch({ set: aSet(10) }).turnOff(NOW);

    await memory.searchRepository.add(search);
    memory.events.splice(0);
    await picking().searchEnded(ended(search, 'stopped'));

    expect(memory.searches.get(search.id.value)?.pick).toBeNull();
    expect(memory.events).toEqual([]);
  });
});

describe('NoticeSearchResults', () => {
  it('tells the team once the config pull request opened, with the change, the held-out gain and the pull request to review', async () => {
    const search = finishedWithNothing();
    const opening = pullRequestOf(search);

    await memory.searchRepository.add(search);
    await memory.candidateRepository.add(
      candidateOf('searched', 'candidate_one'),
    );
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
      {
        workspaceId: STATION.workspaceId,
        teamId: STATION.teamId,
        searchId: search.id,
        addressee: null,
        lineId: STATION.lineId,
        stationId: STATION.stationId,
        about: 'result',
        pullRequest: 'https://github.com/acme/platform/pull/7',
        headline:
          'Spotlight opened a config pull request for the Build station',
        points: [
          'Candidate one changes prompt.',
          'Held-out gain: not measured',
        ],
      },
    ]);
  });

  it('tells the team, and nobody in person, once the config pull request of a requested search opened', async () => {
    const search = finishedWithNothing('user_asking');
    const opening = pullRequestOf(search);

    await memory.searchRepository.add(search);
    await pullRequests.add(opening);
    await noticing().pullRequestOpened(
      new ConfigPullRequestOpened(
        opening.id,
        STATION.workspaceId,
        STATION.teamId,
        STATION.stationId,
        StationFingerprint.of('e'.repeat(64)),
        PullRequestUrl.of('https://github.com/acme/platform/pull/7'),
        later(5),
      ),
    );

    expect(noticed.map((each) => each.addressee)).toEqual([null]);
  });

  it('tells the person who asked why no config pull request opened, and that the search ended before their change', async () => {
    const search = finishedWithNothing('user_asking');

    await memory.searchRepository.add(search);
    await noticing().requestersOfDecline(
      new SearchPickDeclined(search.id, search.workspaceId, 'no-candidate'),
    );

    expect(noticed).toMatchObject([
      {
        addressee: { value: 'user_asking' },
        about: 'result',
        pullRequest: null,
        headline:
          'Spotlight did not open a config pull request for the Build station',
        points: [
          'No candidate did better than the live config on the searched tasks.',
          'Spotlight did not replay asked: the search ended first.',
        ],
      },
    ]);
  });

  it('gives the same notice when the decline arrives twice, so the inbox keeps one', async () => {
    const search = finishedWithNothing('user_asking');
    const declined = new SearchPickDeclined(
      search.id,
      search.workspaceId,
      'no-candidate',
    );

    await memory.searchRepository.add(search);
    await noticing().requestersOfDecline(declined);
    await noticing().requestersOfDecline(declined);

    expect(noticed).toHaveLength(2);
    expect(noticed[1]).toEqual(noticed[0]);
  });

  it('tells nobody of a declined search that nobody asked for', async () => {
    const search = finishedWithNothing();

    await memory.searchRepository.add(search);
    await noticing().requestersOfDecline(
      new SearchPickDeclined(search.id, search.workspaceId, 'no-candidate'),
    );

    expect(noticed).toEqual([]);
  });

  it('tells the person who asked when another candidate became the pull request, with how their change did', async () => {
    const search = withOtherCandidate();

    await memory.searchRepository.add(search);
    await noticing().requestersOfOtherPick(
      new SearchCandidatePicked(
        search.id,
        search.workspaceId,
        CandidateId.of('candidate_other'),
      ),
    );

    expect(noticed).toMatchObject([
      {
        addressee: { value: 'user_asking' },
        headline:
          'Spotlight opened a config pull request for another candidate of the Build station',
        points: [
          'Candidate other became the config pull request.',
          'Candidate asked did not beat the live config on the searched tasks. Searched gain: not measured',
        ],
      },
    ]);
  });

  it('tells nobody in person when the candidate they asked for became the pull request', async () => {
    const search = withOtherCandidate();

    await memory.searchRepository.add(search);
    await noticing().requestersOfOtherPick(
      new SearchCandidatePicked(
        search.id,
        search.workspaceId,
        CandidateId.of('candidate_asked'),
      ),
    );

    expect(noticed).toEqual([]);
  });

  it('tells the person who asked when the search stopped before a result', async () => {
    const search = aSearch({
      set: aSet(10),
      requestedBy: 'user_asking',
    }).turnOff(NOW);

    await memory.searchRepository.add(search);
    await noticing().requestersOfStop(ended(search, 'stopped'));

    expect(noticed).toMatchObject([
      {
        addressee: { value: 'user_asking' },
        points: [
          'A person turned off search for the station.',
          'Spotlight did not replay asked: the search ended first.',
        ],
      },
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
        pullRequest: null,
        points: [
          'Candidate one changes the station config.',
          'Reason: Line delivery has no Terraform source. Please add a source block with repository and path to spotlight_line.',
        ],
      }),
    ]);
  });

  it('advises the team only on the skips a person must fix, the ones that stop improvement', async () => {
    const skipped = (reason: StationSearchSkipped['reason']) =>
      new StationSearchSkipped(
        STATION.workspaceId,
        STATION.teamId,
        STATION.lineId,
        STATION.stationId,
        reason,
        NOW,
      );

    for (const reason of SEARCH_SKIP_REASONS) {
      await noticing().skipped(skipped(reason));
    }

    expect(advised.map((each) => each.about)).toEqual(
      [
        'no-agent',
        'no-scoring',
        'ceiling-too-low',
        'noisy',
        'judge-unstable',
        'flaky-checks',
      ].map((reason) => `${reason} ${NOW.toISOString()}`),
    );
    expect(advised[1]).toMatchObject({
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
    new SearchSchedules(memory.scheduleRepository, work, TRANSACTION, CLOCK);

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

  it('forgets the configs rejected against another live config when the line changes', async () => {
    const rejectedAgainst = StationFingerprint.of('c'.repeat(64));
    const rejected = memory.schedules
      .get(STATION.stationId)
      ?.configRejected(
        StationFingerprint.of('e'.repeat(64)),
        rejectedAgainst,
        NOW,
      );

    memory.schedules.set(STATION.stationId, rejected as StationSearchSchedule);
    await schedules().lineChanged(STATION.lineId);

    expect(memory.schedules.get(STATION.stationId)).toMatchObject({
      rejected: [],
      rejectedAgainst: null,
    });
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
