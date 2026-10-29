import type { RunSummary } from '@replays/application/ports/work.port';
import {
  type ReplayedCandidatesSeen,
  replayedCandidatesView,
  type SetStandard,
} from '@replays/application/services/replayed-candidate-views';
import {
  type ReplayedWorld,
  replayedWorld,
} from '@replays/application/services/replayed-candidates.fake-spec';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import {
  aSet,
  BY,
  candidateOf,
  later,
  NOW,
  replayedAs,
  replayFor,
  SEARCH_ID,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { DEFAULT_MIN_GAIN } from '@replays/domain/services/gain-estimate';
import { scoresOf } from '@replays/domain/services/search-scores';
import { UNREAD_HEALTH } from '@replays/domain/services/set-health';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplayedPeriod } from '@replays/domain/value-objects/replayed-period.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let world: ReplayedWorld;

let STANDARDS: ReadonlyMap<string, SetStandard>;

const ended = (original: number, at: string | null): RunSummary => ({
  runId: RunId.of(`original_${original}`),
  taskId: null,
  stationId: STATION.stationId,
  unreplayableReason: null,
  reason: null,
  title: null,
  state: 'completed',
  endedAt: at ? new Date(at) : null,
  origin: null,
});

const seenIn = (
  more: Partial<ReplayedCandidatesSeen> = {},
): ReplayedCandidatesSeen => ({
  period: ReplayedPeriod.of('30d', NOW),
  truncated: false,
  recent: [...world.replays].sort(
    (one, other) => other.startedAt.getTime() - one.startedAt.getTime(),
  ),
  searches: [world.search],
  searchReplays: world.replays.filter((each) => each.searchId !== null),
  sets: [world.set],
  baselines: world.replays.filter((each) => each.baseline),
  candidates: world.candidates,
  pullRequests: [],
  summaries: [],
  standards: STANDARDS,
  ...more,
});

const onlySet = (more: Partial<ReplayedCandidatesSeen> = {}) => {
  const [station] = replayedCandidatesView(seenIn(more)).stations;
  const [set] = station?.sets ?? [];

  if (!set) {
    throw new Error('no set shown');
  }

  return set;
};

const candidateNamed = (
  name: string,
  more: Partial<ReplayedCandidatesSeen> = {},
) => {
  const found = onlySet(more).candidates.find((each) => each.name === name);

  if (!found) {
    throw new Error(`no candidate ${name}`);
  }

  return found;
};

beforeEach(() => {
  world = replayedWorld();
  STANDARDS = new Map([
    [world.set.id.value, { health: UNREAD_HEALTH, minGain: DEFAULT_MIN_GAIN }],
  ]);
});

describe('replayedCandidatesView', () => {
  it('scores a searched candidate as its search scores it', () => {
    const scores = scoresOf(world.search, world.replays, DEFAULT_MIN_GAIN);

    for (const name of ['terse', 'wordy']) {
      const shown = candidateNamed(name);
      const searched = scores.candidates.find(
        (each) => each.candidateId.value === shown.candidateId,
      );

      expect(shown).toMatchObject({
        replayId: searched?.replayId.value,
        successRate: searched?.searchScore,
        scored: searched?.searchScored,
        costPerRun: searched?.costPerRun,
        heldOut: null,
        tasks: world.search.split.searchedTasks,
        search: {
          searchId: world.search.id.value,
          state: world.search.current,
          startedAt: world.search.startedAt.toISOString(),
        },
      });
    }
  });

  it('counts the regressions against the set baseline it names', () => {
    expect(candidateNamed('terse').regressions).toBe(1);
    expect(candidateNamed('wordy').regressions).toBe(0);
    expect(onlySet().baseline?.replayId).toBe('replay_seed');
  });

  it('shows the live config only as the set baseline, scored over the same tasks beside each candidate', () => {
    const set = onlySet();

    expect(set.candidates.map((each) => each.name).sort()).toEqual([
      'terse',
      'wordy',
    ]);
    expect(set.baseline).toMatchObject({
      replayId: 'replay_seed',
      state: 'finished',
      scored: 10,
      successRate: 1,
      costPerRun: 2,
      currency: 'USD',
    });
    expect(candidateNamed('terse').live).toEqual({
      successRate: 1,
      interval: { rate: 1, low: 1, high: 1 },
      costPerRun: 2,
      currency: 'USD',
    });
    expect(candidateNamed('wordy').regressions).toBe(0);
  });

  it('ranks a set’s candidates by their gain against live, those without one last', () => {
    const gains = onlySet().candidates.map(
      (each) => each.gainOverLive?.gain ?? null,
    );
    const known = gains.filter((each) => each !== null);

    expect(known.length).toBeGreaterThan(0);

    expect(known).toEqual([...known].sort((one, other) => other - one));
    expect(gains.slice(known.length).every((each) => each === null)).toBe(true);
  });

  it('draws the set’s chart in the baseline’s currency and says where each point goes on it', () => {
    const set = onlySet();

    expect(set.chartCurrency).toBe('USD');
    expect(set.baseline?.chartStatus).toBe('priced');
    expect(candidateNamed('terse').chartStatus).toBe('priced');
  });

  it('tells the health of the set from its oldest and newest run ends and its last addition', () => {
    expect(
      onlySet({
        summaries: [
          ended(0, '2026-08-03T10:00:00.000Z'),
          ended(1, '2026-09-28T16:20:00.000Z'),
          ended(2, '2026-07-14T10:00:00.000Z'),
          ended(3, null),
        ],
      }).health,
    ).toEqual({
      tasks: 10,
      runs: 10,
      oldestRunEndedAt: '2026-07-14T10:00:00.000Z',
      newestRunEndedAt: '2026-09-28T16:20:00.000Z',
      lastAddedAt: NOW.toISOString(),
      noise: null,
      saturation: null,
      judge: null,
      checks: null,
      oracle: null,
      minGain: DEFAULT_MIN_GAIN,
    });
    expect(onlySet().health).toMatchObject({
      oldestRunEndedAt: null,
      newestRunEndedAt: null,
    });
  });

  it('shows the baseline’s cost in its own currency, apart from the candidate’s', () => {
    const euros = replayedAs(
      Replay.start({
        id: ReplayId.of('replay_euros'),
        set: world.set,
        candidate: candidateOf('live'),
        baseline: true,
        ceiling: Money.ceiling(100, 'EUR'),
        at: later(5),
        by: BY,
      }),
      () => 'completed',
      4,
      'EUR',
    );

    expect(candidateNamed('terse', { baselines: [euros] })).toMatchObject({
      currency: 'USD',
      live: { successRate: 1, costPerRun: 4, currency: 'EUR' },
    });
  });

  it('shows a held-out score apart from the search score, as the search scores it', () => {
    world = replayedWorld(true);
    const searched = scoresOf(
      world.search,
      world.replays,
      DEFAULT_MIN_GAIN,
    ).candidates.find((each) => each.candidateId.value === 'candidate_terse');

    expect(searched?.heldOutScore).toBe(1);
    expect(candidateNamed('terse').heldOut).toMatchObject({
      replayId: searched?.heldOutReplayId?.value,
      score: searched?.heldOutScore,
      tasks: world.search.split.heldOutTasks,
      runs: world.search.split.heldOut.length,
    });
  });

  it('links a searched candidate to the pull request picking it opened', () => {
    const picked = ConfigPullRequest.pick({
      id: ConfigPullRequestId.of('pr_1'),
      searchId: SEARCH_ID,
      candidateId: CandidateId.of('candidate_terse'),
      station: STATION,
      stationKey: 'build',
      candidateName: 'terse',
      lineKey: 'delivery',
      source: {
        repository: Repository.of('acme/platform'),
        path: 'teams/core/delivery.tf',
      },
      at: NOW,
      by: BY,
    });
    expect(
      candidateNamed('terse', { pullRequests: [picked] }).pullRequest?.id,
    ).toBe('pr_1');
    expect(
      candidateNamed('wordy', { pullRequests: [picked] }).pullRequest,
    ).toBeNull();
  });

  it('sets the seed beside each searched candidate, scored on the same searched runs as its search scores it', () => {
    const { seed } = scoresOf(world.search, world.replays, DEFAULT_MIN_GAIN);

    expect(candidateNamed('terse').search?.seed).toMatchObject({
      successRate: seed.searchScore,
      costPerRun: seed.costPerRun,
      scored: seed.searchScored,
      chartStatus: 'priced',
    });
    expect(candidateNamed('terse').search?.seed.scored).toBe(
      world.search.split.searched.length,
    );
  });

  it('rates a candidate on the compared runs beside the baseline, apart from its overall rate', () => {
    const partial = replayedAs(
      replayFor(aSet(5), 'replay_partial', 'candidate_live', null, true),
      () => 'completed',
      2,
    );
    const shown = candidateNamed('terse', { baselines: [partial] });

    expect(shown).toMatchObject({
      successRate: 6 / 7,
      scored: 7,
      compared: 3,
      successRateOnCompared: 2 / 3,
      costPerRunOnCompared: 1,
      regressions: 1,
      live: { successRate: 1, costPerRun: 2, currency: 'USD' },
      shown: {
        basis: 'compared',
        costBasis: 'compared',
        successRate: 2 / 3,
        liveSuccessRate: 1,
        runs: 3,
        costPerRun: 1,
        liveCostPerRun: 2,
      },
    });
  });

  it('counts distinct tasks apart from runs', () => {
    expect(candidateNamed('terse')).toMatchObject({
      tasks: world.search.split.searchedTasks,
      runs: world.search.split.searched.length,
    });
  });

  it('shows nothing for a set with no candidate in the period', () => {
    expect(
      replayedCandidatesView({
        period: ReplayedPeriod.of('30d', NOW),
        truncated: true,
        recent: [],
        searches: [],
        searchReplays: [],
        sets: [world.set],
        baselines: world.replays,
        candidates: world.candidates,
        pullRequests: [],
        summaries: [],
        standards: STANDARDS,
      }),
    ).toMatchObject({ truncated: true, stations: [] });
  });
});
