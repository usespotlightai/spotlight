import type { StandingRun } from '@replays/application/ports/work.port';
import { ReadReplayHandler } from '@replays/application/queries/handlers/read-replay.handler';
import { ReadReplayQuery } from '@replays/application/queries/read-replay.query';
import {
  type ReplayedCandidatesSeen,
  replayedCandidatesView,
  type SetStandard,
} from '@replays/application/services/replayed-candidate-views';
import {
  type ReplayedWorld,
  replayedWorld,
  replayOf,
} from '@replays/application/services/replayed-candidates.fake-spec';
import {
  accessFor,
  FakeWork,
  InMemoryReplays,
  PERSON,
} from '@replays/application/services/replays.fake-spec';
import { searchDetailView } from '@replays/application/services/search-views';
import { SetHealths } from '@replays/application/services/set-healths.service';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
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
import { DEFAULT_MIN_GAIN } from '@replays/domain/services/gain-reading';
import { UNREAD_HEALTH } from '@replays/domain/services/set-health';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { ReplayedPeriod } from '@replays/domain/value-objects/replayed-period.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let world: ReplayedWorld;

let STANDARDS: ReadonlyMap<string, SetStandard>;

const ended = (original: number, at: string | null): StandingRun => ({
  runId: RunId.of(`original_${original}`),
  taskId: null,
  stationId: STATION.stationId,
  refusal: null,
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
  standing: [],
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

const replayPage = async (replayId: string) => {
  const memory = new InMemoryReplays();
  const work = new FakeWork();

  for (const each of world.replays) {
    await memory.replayRepository.add(each);
  }
  for (const each of world.candidates) {
    await memory.candidateRepository.add(each);
  }

  return new ReadReplayHandler(
    accessFor(memory, work),
    memory.replayRepository,
    memory.candidateRepository,
    work,
    new SetHealths(work, memory.replayRepository, memory.candidateRepository),
  ).execute(new ReadReplayQuery(STATION.teamId.value, replayId, PERSON));
};

beforeEach(() => {
  world = replayedWorld();
  STANDARDS = new Map([
    [world.set.id.value, { health: UNREAD_HEALTH, minGain: DEFAULT_MIN_GAIN }],
  ]);
});

describe('replayedCandidatesView', () => {
  it('scores a searched candidate exactly as its search page does', () => {
    const page = searchDetailView(
      world.search,
      world.replays,
      world.candidates,
      [],
      DEFAULT_MIN_GAIN,
    );

    for (const name of ['terse', 'wordy']) {
      const shown = candidateNamed(name);
      const searched = page.candidates.find((each) => each.name === name);

      expect(shown).toMatchObject({
        kind: 'searched',
        candidateId: searched?.candidateId,
        replayId: searched?.replayId,
        replayState: searched?.replayState,
        successRate: searched?.searchScore,
        scored: searched?.searchScored,
        costPerRun: searched?.costPerRun,
        onFrontier: searched?.onFrontier,
        hypothesis: searched?.hypothesis,
        fingerprint: searched?.fingerprint,
        changes: searched?.changes,
        heldOut: null,
        tasks: page.split.searchedTasks,
        search: {
          searchId: page.id,
          state: page.state,
          startedAt: page.startedAt,
        },
      });
    }
  });

  it('scores a proposed candidate as its replay page totals it, with no search, frontier or held-out', async () => {
    const page = await replayPage('replay_proposed');

    expect(candidateNamed('Shorter prompt')).toMatchObject({
      kind: 'proposed',
      replayId: 'replay_proposed',
      replayState: page.state,
      replayedAt: page.startedAt,
      tasks: page.totals.entries,
      successRate: page.totals.successRate,
      scored: page.totals.scored,
      costPerRun: 3,
      heldOut: null,
      onFrontier: null,
      search: null,
      pullRequest: null,
    });
  });

  it('counts the regressions the replay page shows, against the set baseline it names', async () => {
    for (const [name, replayId] of [
      ['terse', 'replay_terse'],
      ['Shorter prompt', 'replay_proposed'],
    ] as const) {
      const page = await replayPage(replayId);
      const shown = candidateNamed(name);

      expect(shown.regressions).toBe(
        page.comparison.filter((each) => each.regressed).length,
      );
      expect(shown.compared).toBe(
        page.comparison.filter((each) => each.baseline !== null).length,
      );
      expect(onlySet().baseline?.replayId).toBe(page.baselineReplayId);
    }
    expect(candidateNamed('Shorter prompt').regressions).toBe(2);
    expect(candidateNamed('terse').regressions).toBe(1);
  });

  it('shows the live config only as the set baseline, scored over the same tasks beside each candidate', () => {
    const set = onlySet();

    expect(set.candidates.map((each) => each.name).sort()).toEqual([
      'Shorter prompt',
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

  it('tells how the set stands from its oldest and newest run ends and its last addition', () => {
    expect(
      onlySet({
        standing: [
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
      sanity: null,
      minGain: DEFAULT_MIN_GAIN,
    });
    expect(onlySet().health).toMatchObject({
      oldestRunEndedAt: null,
      newestRunEndedAt: null,
    });
  });

  it('gives the baseline’s cost in its own currency, apart from the candidate’s', () => {
    const euros = replayedAs(
      Replay.started({
        id: ReplayId.of('replay_euros'),
        set: world.set,
        candidate: candidateOf('live'),
        baseline: true,
        ceiling: Spend.ceiling(100, 'EUR'),
        at: later(5),
        by: BY,
      }),
      () => 'completed',
      4,
      'EUR',
    );

    expect(
      candidateNamed('Shorter prompt', { baselines: [euros] }),
    ).toMatchObject({
      currency: 'USD',
      costPerRun: 3,
      live: { successRate: 1, costPerRun: 4, currency: 'EUR' },
    });
  });

  it('shows a proposed candidate’s newest finished replay in the period over a newer one still running', () => {
    const running = replayOf(
      world.set,
      'replay_running',
      candidateOf('proposed'),
      later(10),
    );

    expect(
      candidateNamed('Shorter prompt', {
        recent: [running, ...seenIn().recent],
      }).replayId,
    ).toBe('replay_proposed');
    expect(
      candidateNamed('Shorter prompt', {
        recent: [running],
      }).replayId,
    ).toBe('replay_running');
  });

  it('gives a held-out score apart from the search score, as the search page does', () => {
    world = replayedWorld(true);
    const page = searchDetailView(
      world.search,
      world.replays,
      world.candidates,
      [],
      DEFAULT_MIN_GAIN,
    );
    const searched = page.candidates.find((each) => each.name === 'terse');

    expect(searched?.heldOutScore).toBe(1);
    expect(candidateNamed('terse').heldOut).toEqual({
      replayId: searched?.heldOutReplayId,
      state: searched?.heldOutReplayState,
      score: searched?.heldOutScore,
      interval: searched?.heldOutInterval,
      tasks: page.split.heldOutTasks,
      runs: world.search.split.heldOut.length,
    });
  });

  it('links a searched candidate to the pull request picking it opened', () => {
    const picked = ConfigPullRequest.picked({
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
    const page = searchDetailView(
      world.search,
      world.replays,
      world.candidates,
      [picked],
      DEFAULT_MIN_GAIN,
    );

    expect(
      candidateNamed('terse', { pullRequests: [picked] }).pullRequest,
    ).toEqual(
      page.candidates.find((each) => each.name === 'terse')?.pullRequest,
    );
    expect(
      candidateNamed('terse', { pullRequests: [picked] }).pullRequest?.id,
    ).toBe('pr_1');
    expect(
      candidateNamed('wordy', { pullRequests: [picked] }).pullRequest,
    ).toBeNull();
  });

  it('sets the seed beside each searched candidate, scored on the same searched runs as its search page shows', () => {
    const page = searchDetailView(
      world.search,
      world.replays,
      world.candidates,
      [],
      DEFAULT_MIN_GAIN,
    );

    expect(candidateNamed('terse').search?.seed).toEqual({
      successRate: page.seed.searchScore,
      interval: page.seed.searchInterval,
      costPerRun: page.seed.costPerRun,
      scored: page.seed.searchScored,
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
    const shown = candidateNamed('Shorter prompt', { baselines: [partial] });

    expect(shown).toMatchObject({
      successRate: 0.8,
      scored: 10,
      compared: 5,
      successRateOnCompared: 0.6,
      costPerRunOnCompared: 3,
      regressions: 2,
      live: { successRate: 1, costPerRun: 2, currency: 'USD' },
    });
  });

  it('counts distinct tasks apart from runs when a task was worked twice', () => {
    const twice = [
      ['run_a', 'task_x'],
      ['run_b', 'task_x'],
      ['run_c', 'task_y'],
    ].reduce(
      (set, [run, task]) =>
        set.withEntry(
          {
            runId: RunId.of(run as string),
            taskId: TaskId.of(task as string),
            stationId: STATION.stationId,
            refusal: null,
            reason: null,
          },
          NOW,
          false,
        ),
      ReplaySet.opened({
        id: ReplaySetId.of('set_twice'),
        station: STATION,
        name: ReplaySetName.of('Twice'),
        at: NOW,
      }),
    );
    const baseline = replayedAs(
      replayFor(twice, 'replay_twice_live', 'candidate_live', null, true),
      () => 'completed',
    );
    const proposed = replayedAs(
      replayOf(twice, 'replay_twice', candidateOf('proposed'), later(1)),
      (original) => (original === 'run_b' ? 'failed' : 'completed'),
    );
    const [station] = replayedCandidatesView(
      seenIn({
        recent: [proposed],
        searches: [],
        searchReplays: [],
        sets: [twice],
        baselines: [baseline],
        standards: new Map([
          [
            twice.id.value,
            { health: UNREAD_HEALTH, minGain: DEFAULT_MIN_GAIN },
          ],
        ]),
      }),
    ).stations;
    const [set] = station?.sets ?? [];

    expect(set?.health).toMatchObject({ tasks: 2, runs: 3 });
    expect(set?.candidates[0]).toMatchObject({
      tasks: 2,
      runs: 3,
      scored: 3,
      compared: 3,
      successRate: 2 / 3,
      successRateOnCompared: 2 / 3,
    });
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
        standing: [],
        standards: STANDARDS,
      }),
    ).toMatchObject({ truncated: true, stations: [] });
  });
});
