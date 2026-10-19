import { heldOutOf } from '@replays/application/services/replayed-candidates.fake-spec';
import {
  searchDetailView,
  searchSummaryView,
} from '@replays/application/services/search-views';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import {
  aSearch,
  aSet,
  NOW,
  replayedAs,
  replayFor,
  searchRunIds,
} from '@replays/domain/replays.fake-spec';
import { DEFAULT_MIN_GAIN } from '@replays/domain/services/gain-estimate';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { RunResult } from '@replays/domain/value-objects/replay-ending';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const RUN_ONE = RunId.of('search_run_1');

const allowing = (maxRegressions: number): ReplayThreshold =>
  ReplayThreshold.of({
    maxRegressions,
    ceiling: 10,
    currency: 'USD',
    minGain: 0.05,
  });

type OutcomeOf = (original: string, split: Search['split']) => RunResult;

interface Outcomes {
  readonly seed: OutcomeOf;
  readonly terse: OutcomeOf;
  readonly heldOutTerse: OutcomeOf;
}

const worldOf = (
  tasks: number,
  outcomes: Outcomes,
): { search: Search; replays: readonly Replay[] } => {
  const set = aSet(tasks);
  const ids = searchRunIds();
  const searching = aSearch({ set })
    .recordReplayStopReason(
      ReplayId.of('replay_seed'),
      'finished',
      { spent: Money.of(10, 'USD'), unpriced: 0 },
      NOW,
      ids,
      true,
    )
    .acceptProposal(RUN_ONE, {
      candidateId: CandidateId.of('candidate_terse'),
      name: CandidateName.searched('terse'),
      replayId: ReplayId.of('replay_terse'),
    })
    .acceptProposal(RUN_ONE, {
      candidateId: CandidateId.of('candidate_wordy'),
      name: CandidateName.searched('wordy'),
      replayId: ReplayId.of('replay_wordy'),
    });
  const searched = [
    replayedAs(
      replayFor(set, 'replay_seed', 'candidate_live', null, true),
      (original) => outcomes.seed(original, searching.split),
    ),
    replayedAs(
      replayFor(
        set,
        'replay_terse',
        'candidate_terse',
        searching.split.searchedRuns,
      ),
      (original) => outcomes.terse(original, searching.split),
    ),
    replayedAs(
      replayFor(
        set,
        'replay_wordy',
        'candidate_wordy',
        searching.split.searchedRuns,
      ),
      () => 'failed',
    ),
  ];
  const search = heldOutOf(searching, searched, ids);

  return {
    search,
    replays: [
      ...searched,
      replayedAs(
        replayFor(
          set,
          'replay_held_out_terse',
          'candidate_terse',
          search.split.heldOutRuns,
        ),
        (original) => outcomes.heldOutTerse(original, search.split),
      ),
    ],
  };
};

const heldOutWorld = (tasks: number) =>
  worldOf(tasks, {
    seed: () => 'failed',
    terse: () => 'completed',
    heldOutTerse: (original, split) =>
      original === split.heldOutRuns[0]?.value ? 'completed' : 'failed',
  });

const among = (original: string, runs: readonly RunId[]): boolean =>
  runs.some((each) => each.value === original);

const regressedWorld = () =>
  worldOf(20, {
    seed: (original, split) =>
      among(original, [
        ...split.searchedRuns.slice(0, 3),
        ...split.heldOutRuns.slice(2, 5),
      ])
        ? 'failed'
        : 'completed',
    terse: (original, split) =>
      among(original, split.searchedRuns.slice(3, 4)) ? 'failed' : 'completed',
    heldOutTerse: (original, split) =>
      among(original, split.heldOutRuns.slice(0, 2)) ? 'failed' : 'completed',
  });

describe('search views', () => {
  it('marks the best candidate and the candidate itself when the gain showed only on the searched tasks', () => {
    const { search, replays } = heldOutWorld(20);

    const summary = searchSummaryView(search, replays, DEFAULT_MIN_GAIN, null);
    const detail = searchDetailView(
      search,
      replays,
      [],
      [],
      DEFAULT_MIN_GAIN,
      null,
    );

    expect(summary.best).toMatchObject({
      name: 'terse',
      overfit: 'likely',
    });
    expect(
      detail.candidates.find((each) => each.name === 'terse')?.overfit,
    ).toBe('likely');
    expect(detail.seed.overfit).toBeNull();
    expect(detail.overfitCount).toBe(1);
  });

  it('says too few held-out tasks were scored to tell, and does not count it as overfit', () => {
    const { search, replays } = heldOutWorld(10);

    const detail = searchDetailView(
      search,
      replays,
      [],
      [],
      DEFAULT_MIN_GAIN,
      null,
    );

    expect(detail.best).toMatchObject({
      name: 'terse',
      overfit: 'too-few-held-out',
    });
    expect(
      detail.candidates.find((each) => each.name === 'terse')?.overfit,
    ).toBe('too-few-held-out');
    expect(detail.overfitCount).toBe(0);
  });

  it('counts each candidate’s regressions on the searched and held-out tasks, and none for the seed', () => {
    const { search, replays } = regressedWorld();

    const detail = searchDetailView(
      search,
      replays,
      [],
      [],
      DEFAULT_MIN_GAIN,
      null,
    );
    const terse = detail.candidates.find((each) => each.name === 'terse');

    expect(terse?.onFrontier).toBe(true);
    expect(terse?.regressions).toEqual({ searched: 1, heldOut: 2, total: 3 });
    expect(terse?.exceedsRegressionLimit).toBe(false);
    expect(detail.seed.regressions).toEqual({
      searched: null,
      heldOut: null,
      total: null,
    });
    expect(detail.best).toMatchObject({
      name: 'terse',
      regressions: { searched: 1, heldOut: 2, total: 3 },
      exceedsRegressionLimit: false,
    });
    expect(detail.maxRegressions).toBeNull();
  });

  it('marks a candidate whose searched and held-out regressions together are over the line’s regression limit, and keeps it on the frontier and best', () => {
    const { search, replays } = regressedWorld();

    const over = searchDetailView(
      search,
      replays,
      [],
      [],
      DEFAULT_MIN_GAIN,
      allowing(2),
    );
    const within = searchDetailView(
      search,
      replays,
      [],
      [],
      DEFAULT_MIN_GAIN,
      allowing(3),
    );
    const summary = searchSummaryView(
      search,
      replays,
      DEFAULT_MIN_GAIN,
      allowing(2),
    );

    expect(over.maxRegressions).toBe(2);
    expect(summary.maxRegressions).toBe(2);
    expect(over.candidates.find((each) => each.name === 'terse')).toMatchObject(
      { exceedsRegressionLimit: true, onFrontier: true },
    );
    expect(over.frontier).toContain('candidate_terse');
    expect(over.seed.exceedsRegressionLimit).toBe(false);
    expect(summary.best).toMatchObject({
      name: 'terse',
      exceedsRegressionLimit: true,
    });
    expect(
      within.candidates.find((each) => each.name === 'terse')
        ?.exceedsRegressionLimit,
    ).toBe(false);
  });
});
