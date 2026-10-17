import type { Search } from '@replays/domain/aggregates/search.aggregate';
import {
  aSearch,
  aSet,
  later,
  NOW,
  replayedAs,
  replayFor,
  searchRunIds,
} from '@replays/domain/replays.fake-spec';
import { frontierOf } from '@replays/domain/services/frontier';
import { scoresOf } from '@replays/domain/services/search-scores';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const SET = aSet(10);

const RUN_ONE = RunId.of('search_run_1');

const searchWith = (): Search => {
  const ids = searchRunIds();

  return aSearch({ set: SET })
    .recordReplayEnd(
      ReplayId.of('replay_seed'),
      'finished',
      { spent: Spend.of(10, 'USD'), unpriced: 0 },
      NOW,
      ids,
      true,
    )
    .admitted(RUN_ONE, {
      candidateId: CandidateId.of('candidate_terse'),
      name: CandidateName.searched('terse'),
      replayId: ReplayId.of('replay_terse'),
    })
    .admitted(RUN_ONE, {
      candidateId: CandidateId.of('candidate_wordy'),
      name: CandidateName.searched('wordy'),
      replayId: ReplayId.of('replay_wordy'),
    });
};

describe('scoresOf', () => {
  it('scores the seed on the searched tasks and, apart, on the held-out ones, from its one full-set replay', () => {
    const search = searchWith();
    const heldOut = new Set(search.split.heldOutRuns.map((each) => each.value));
    const seed = replayedAs(
      replayFor(SET, 'replay_seed', 'candidate_live', null, true),
      (original) => (heldOut.has(original) ? 'failed' : 'completed'),
      2,
    );

    const scores = scoresOf(search, [seed], 0.05);

    expect(scores.seed.seed).toBe(true);
    expect(scores.seed.finished).toBe(true);
    expect(scores.seed.searchScore).toBe(1);
    expect(scores.seed.searchScored).toBe(search.split.searched.length);
    expect(scores.seed.heldOutScore).toBe(0);
    expect(scores.seed.costPerRun).toBe(2);
    expect(scores.seed.spent.amount).toBe(20);
  });

  it('scores each candidate on its search replay, with no held-out score until its held-out replay finished', () => {
    const search = searchWith();
    const terse = replayedAs(
      replayFor(
        SET,
        'replay_terse',
        'candidate_terse',
        search.split.searchedRuns,
      ),
      (original) => (original === 'original_0' ? 'failed' : 'completed'),
    );
    const wordy = replayFor(
      SET,
      'replay_wordy',
      'candidate_wordy',
      search.split.searchedRuns,
    );

    const scores = scoresOf(search, [terse, wordy], 0.05);
    const [first, second] = scores.candidates;
    const searched = search.split.searched.length;
    const failedOne = search.split.searchedRuns.some(
      (each) => each.value === 'original_0',
    );

    expect(first?.candidateId.value).toBe('candidate_terse');
    expect(first?.finished).toBe(true);
    expect(first?.searchScored).toBe(searched);
    expect(first?.searchScore).toBeCloseTo(
      failedOne ? (searched - 1) / searched : 1,
    );
    expect(first?.heldOutScore).toBeNull();
    expect(first?.costPerRun).toBe(1);
    expect(second?.finished).toBe(false);
    expect(second?.searchScore).toBeNull();
    expect(second?.costPerRun).toBeNull();
    expect(scores.seed.searchScore).toBeNull();
    expect(scores.seed.finished).toBe(false);
  });

  it('tallies each candidate’s side-by-side verdicts against the seed, and none for the seed itself or a candidate not yet replayed', () => {
    const search = searchWith();
    const seed = replayedAs(
      replayFor(SET, 'replay_seed', 'candidate_live', null, true),
      () => 'completed',
    );
    const terse = replayedAs(
      replayFor(
        SET,
        'replay_terse',
        'candidate_terse',
        search.split.searchedRuns,
        false,
        1,
        undefined,
        'replay_seed',
      ),
      () => 'completed',
    );

    const scores = scoresOf(search, [seed, terse], 0.05);
    const [first, second] = scores.candidates;

    expect(scores.seed.searchedPairs).toBeNull();
    expect(first?.searchedPairs).toEqual({ wins: 0, losses: 0, ties: 0 });
    expect(first?.heldOutPairs).toBeNull();
    expect(second?.searchedPairs).toBeNull();
  });

  it('gives a held-out score once the candidate’s held-out replay finished, and feeds the frontier', () => {
    const ids = searchRunIds();
    let search = searchWith()
      .recordRunEnd(RUN_ONE, { failed: false, started: true }, later(1), ids)
      .recordAgentSpend(RUN_ONE, ModelSpent.of([], 0), later(1), ids)
      .recordReplayEnd(
        ReplayId.of('replay_terse'),
        'finished',
        { spent: Spend.of(1, 'USD'), unpriced: 0 },
        later(2),
        ids,
        true,
      )
      .recordReplayEnd(
        ReplayId.of('replay_wordy'),
        'finished',
        { spent: Spend.of(1, 'USD'), unpriced: 0 },
        later(2),
        ids,
        true,
      );

    for (let more = 2; more <= search.budget.iterations; more += 1) {
      const active = search.activeRun as RunId;

      search = search
        .recordRunEnd(active, { failed: false, started: true }, later(3), ids)
        .recordAgentSpend(active, ModelSpent.of([], 0), later(3), ids);
    }

    expect(search.current).toBe('holding-out');

    const seed = replayedAs(
      replayFor(SET, 'replay_seed', 'candidate_live', null, true),
      () => 'completed',
      3,
    );
    const terse = replayedAs(
      replayFor(
        SET,
        'replay_terse',
        'candidate_terse',
        search.split.searchedRuns,
      ),
      () => 'completed',
    );
    const wordy = replayedAs(
      replayFor(
        SET,
        'replay_wordy',
        'candidate_wordy',
        search.split.searchedRuns,
      ),
      () => 'failed',
      0.5,
    );
    let heldOutCount = 0;

    search = search.heldOutFrom(
      [seed, terse, wordy],
      0.05,
      () => ReplayId.of(`held_out_${++heldOutCount}`),
      later(4),
    );

    expect(
      search.heldOut.map((each) => [
        each.candidateId.value,
        each.replay.replayId.value,
      ]),
    ).toEqual([
      ['candidate_terse', 'held_out_1'],
      ['candidate_wordy', 'held_out_2'],
    ]);

    const heldOutTerse = replayedAs(
      replayFor(SET, 'held_out_1', 'candidate_terse', search.split.heldOutRuns),
      () => 'completed',
    );

    const scores = scoresOf(search, [seed, terse, wordy, heldOutTerse], 0.05);
    const terseScores = scores.candidates.find(
      (each) => each.candidateId.value === 'candidate_terse',
    );

    expect(terseScores?.heldOutScore).toBe(1);
    expect(terseScores?.heldOutReplayId?.value).toBe('held_out_1');
    expect(terseScores?.spent.amount).toBe(10);
    expect(
      frontierOf([scores.seed, ...scores.candidates], 'success').map(
        (each) => each.candidateId.value,
      ),
    ).toEqual(['candidate_wordy', 'candidate_terse', 'candidate_live']);
  });

  it('names no cost per run where a run went unpriced or was priced in another currency', () => {
    const search = searchWith();
    const unpriced = replayedAs(
      replayFor(
        SET,
        'replay_terse',
        'candidate_terse',
        search.split.searchedRuns,
      ),
      () => 'completed',
      null,
    );
    const elsewhere = replayedAs(
      replayFor(
        SET,
        'replay_wordy',
        'candidate_wordy',
        search.split.searchedRuns,
      ),
      () => 'completed',
      1,
      'EUR',
    );
    const [terse, wordy] = scoresOf(
      search,
      [unpriced, elsewhere],
      0.05,
    ).candidates;

    expect(terse?.searchScore).toBe(1);
    expect(terse?.costPerRun).toBeNull();
    expect(wordy?.searchScore).toBe(1);
    expect(wordy?.costPerRun).toBeNull();
  });

  it('scores a candidate only on the searched runs, though its replay ran others', () => {
    const search = searchWith();
    const stray = replayedAs(
      replayFor(SET, 'replay_terse', 'candidate_terse', null),
      (original) =>
        search.split.heldOutRuns.some((each) => each.value === original)
          ? 'failed'
          : 'completed',
    );
    const [terse] = scoresOf(search, [stray], 0.05).candidates;

    expect(terse?.searchScore).toBe(1);
    expect(terse?.searchScored).toBe(search.split.searched.length);
    expect(terse?.spent.amount).toBe(search.split.searched.length);
  });
});

describe('scoresOf, gains', () => {
  it('reads no searched gain until the candidate’s searched replay finished', () => {
    const search = searchWith();
    const seed = replayedAs(
      replayFor(SET, 'replay_seed', 'candidate_live', null, true),
      () => 'completed',
    );
    const terse = replayedAs(
      replayFor(
        SET,
        'replay_terse',
        'candidate_terse',
        search.split.searchedRuns,
      ),
      () => 'completed',
    );
    const wordy = replayFor(
      SET,
      'replay_wordy',
      'candidate_wordy',
      search.split.searchedRuns,
    );

    const scores = scoresOf(search, [seed, terse, wordy], 0.05);
    const [terseScores, wordyScores] = scores.candidates;

    expect(terseScores?.searchedGain).not.toBeNull();
    expect(terseScores?.searchedVerdict).toBe(
      terseScores?.searchedGain?.verdict,
    );
    expect(wordyScores?.searchedGain).toBeNull();
    expect(wordyScores?.searchedVerdict).toBeNull();
    expect(scores.seed.searchedGain).toBeNull();
  });
});
