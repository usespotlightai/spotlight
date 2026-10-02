import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import {
  aReplay,
  candidateOf,
  endOf,
  FINGERPRINT,
  later,
  measuresOf,
  NOW,
  RUBRIC,
  runIds,
} from '@replays/domain/replays.fake-spec';
import {
  comparedWith,
  totalsOf,
} from '@replays/domain/services/replay-results';
import {
  ChangeChecks,
  type StackState,
} from '@replays/domain/value-objects/change-checks.vo';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const run = (at: number) => RunId.of(`replay_run_${at}`);

type Ran = 'passed' | 'failed-check' | 'failed-run' | 'unchecked';

const checksOf = (state: StackState) =>
  ChangeChecks.of([
    {
      repository: 'api',
      state,
      skip: null,
      failedAt: state === 'failed' ? ['the whole change'] : [],
      spent: ModelSpent.of([], 0),
    },
  ]);

const settled = (replay: Replay, at: number, how: Ran, cost: number) => {
  const confirmed = replay
    .confirmed(run(at), FINGERPRINT, NOW)
    .ended(run(at), endOf(how === 'failed-run' ? 'failed' : 'completed'));
  const reviewed = confirmed.reviewed(
    run(at),
    how === 'passed'
      ? checksOf('passed')
      : how === 'failed-check'
        ? checksOf('failed')
        : ChangeChecks.of([]),
    null,
    later(60_000),
  );

  return reviewed.measured(run(at), measuresOf(cost), later(61_000));
};

const ran = (
  id: string,
  runs: readonly Ran[],
  costs: readonly number[],
  baseline = false,
  rubric: string | null = null,
) =>
  runs.reduce(
    (replay, how, at) => settled(replay, at, how, costs[at] ?? 1),
    aReplay({
      id,
      count: runs.length,
      ceiling: 100,
      baseline,
      candidate: candidateOf(
        baseline ? 'live' : 'proposed',
        `candidate_${id}`,
        rubric,
      ),
    }).reserving(runs.length, runIds()),
  );

const scoredAs = (score: number) =>
  JudgeVerdict.of({
    scale: 'number',
    value: score,
    model: 'judge/model',
    referenced: true,
    reasons: [{ text: 'It drains the queue.', steps: [3], hunks: [] }],
  });

describe('totalsOf', () => {
  it('counts what it spent in other currencies and the calls nobody priced, beside what counts against the ceiling', () => {
    const replay = aReplay({ count: 3, ceiling: 100 })
      .reserving(3, runIds())
      .confirmed(run(0), FINGERPRINT, NOW)
      .confirmed(run(1), FINGERPRINT, NOW)
      .confirmed(run(2), FINGERPRINT, NOW)
      .measured(run(0), measuresOf(1), later(1))
      .measured(run(1), measuresOf(2, 60_000, 10, 'EUR'), later(1))
      .measured(run(2), measuresOf(null), later(1))
      .reviewed(
        run(0),
        checksOf('passed'),
        ModelSpent.of([Spend.of(0.5, 'USD'), Spend.of(0.3, 'GBP')], 2),
        later(2),
      );
    const totals = totalsOf(replay);

    expect(totals.spent).toEqual(Spend.of(1.5, 'USD'));
    expect(totals.spentElsewhere).toEqual([
      Spend.of(2, 'EUR'),
      Spend.of(0.3, 'GBP'),
    ]);
    expect(totals.unpricedCalls).toBe(2);
  });

  it('counts endings, adds up cost, steps and time, and takes their medians', () => {
    const replay = ran(
      'replay_1',
      ['passed', 'failed-run', 'unchecked'],
      [1, 2, 4],
    );
    const totals = totalsOf(replay);

    expect(totals.entries).toBe(3);
    expect(totals.settled).toBe(3);
    expect(totals.endings.completed).toBe(2);
    expect(totals.endings.failed).toBe(1);
    expect(totals.spent.amount).toBe(7);
    expect(totals.steps).toBe(30);
    expect(totals.medianSteps).toBe(10);
    expect(totals.ms).toBe(180_000);
    expect(totals.medianMs).toBe(60_000);
    expect(totals.unpriced).toBe(0);
  });

  it('rates success over the scored entries only, counting the unscored apart', () => {
    const totals = totalsOf(
      ran('replay_1', ['passed', 'failed-check', 'unchecked', 'passed'], []),
    );

    expect(totals.scored).toBe(3);
    expect(totals.unscored).toBe(1);
    expect(totals.succeeded).toBe(2);
    expect(totals.successRate).toBeCloseTo(2 / 3);
  });

  it('totals only the runs it is given, when given some', () => {
    const replay = ran(
      'replay_1',
      ['passed', 'failed-run', 'passed', 'failed-check'],
      [1, 2, 4, 8],
    );
    const totals = totalsOf(replay, [
      RunId.of('original_0'),
      RunId.of('original_1'),
    ]);

    expect(totals.entries).toBe(2);
    expect(totals.scored).toBe(2);
    expect(totals.successRate).toBe(0.5);
    expect(totals.spent.amount).toBe(3);
    expect(totalsOf(replay, [RunId.of('original_2')]).successRate).toBe(1);
    expect(totalsOf(replay).spent.amount).toBe(15);
  });

  it('counts runs whose cost was not reported as unpriced', () => {
    const replay = aReplay({ count: 1 })
      .reserving(1, runIds())
      .measured(run(0), measuresOf(null), NOW);

    expect(totalsOf(replay).settled).toBe(0);
  });
});

describe('comparedWith', () => {
  it('sets each task against the baseline, regressions first, with deltas once both settled', () => {
    const baseline = ran(
      'baseline',
      ['passed', 'passed', 'failed-run'],
      [1, 1, 1],
      true,
    );
    const candidate = ran(
      'candidate',
      ['passed', 'failed-check', 'passed'],
      [0.5, 2, 1],
    );

    const compared = comparedWith(candidate, baseline);

    expect(compared.map((each) => [each.original, each.regressed])).toEqual([
      ['original_1', true],
      ['original_0', false],
      ['original_2', false],
    ]);
    expect(compared[1]?.costDelta).toBe(-0.5);
    expect(compared[1]?.msDelta).toBe(0);
    expect(compared[1]?.stepsDelta).toBe(0);
    expect(compared[1]?.scoreDelta).toBeNull();
  });

  it('counts a drop in the judge’s score as a regression, even where both succeeded', () => {
    const judged = (replay: Replay, scores: readonly number[]) =>
      scores.reduce(
        (held, score, at) =>
          held.judged(run(at), scoredAs(score), null, later(90_000)),
        replay,
      );
    const baseline = judged(
      ran('baseline', ['passed', 'passed'], [], true, RUBRIC),
      [5, 4],
    );
    const candidate = judged(
      ran('candidate', ['passed', 'passed'], [], false, RUBRIC),
      [4, 5],
    );

    const compared = comparedWith(candidate, baseline);

    expect(
      compared.map((each) => [
        each.original,
        each.scoreDelta,
        each.regressed,
        each.candidate.succeeded,
      ]),
    ).toEqual([
      ['original_0', -1, true, true],
      ['original_1', 1, false, true],
    ]);
  });

  it('compares no scores the two judged by other rubrics, or against a reference only one had, and says why', () => {
    const judged = (replay: Replay, referenced: boolean) =>
      replay.judged(
        run(0),
        JudgeVerdict.of({
          scale: 'number',
          value: 2,
          model: 'judge/model',
          referenced,
          reasons: [],
        }),
        null,
        later(90_000),
      );
    const baseline = judged(
      ran('baseline', ['passed'], [], true, RUBRIC),
      true,
    );

    expect(
      comparedWith(
        judged(
          ran('candidate', ['passed'], [], false, `${RUBRIC} More.`),
          true,
        ),
        baseline,
      )[0],
    ).toMatchObject({ scoreDelta: null, scoreUncompared: 'other-rubric' });
    expect(
      comparedWith(
        judged(ran('candidate', ['passed'], [], false, RUBRIC), false),
        baseline,
      )[0],
    ).toMatchObject({ scoreDelta: null, scoreUncompared: 'other-reference' });
    expect(
      comparedWith(
        judged(ran('candidate', ['passed'], [], false, RUBRIC), true),
        baseline,
      )[0],
    ).toMatchObject({ scoreDelta: 0, scoreUncompared: null });
  });

  it('calls nothing a regression that neither side could score', () => {
    const compared = comparedWith(
      ran('candidate', ['failed-run'], []),
      ran('baseline', ['unchecked'], [], true),
    );

    expect(compared[0]?.regressed).toBe(false);
  });

  it('calls no task a regression that the candidate could not replay or start, where its baseline passed', () => {
    const refused = aReplay({
      id: 'candidate',
      count: 1,
      ceiling: 100,
      candidate: candidateOf('proposed', 'candidate_candidate'),
    })
      .reserving(1, runIds())
      .refused(run(0), 'candidate-unfit', NOW);
    const compared = comparedWith(
      refused,
      ran('baseline', ['passed'], [1], true),
    );

    expect(compared[0]?.candidate.succeeded).toBeNull();
    expect(compared[0]?.regressed).toBe(false);
    expect(totalsOf(refused).unscored).toBe(1);
  });

  it('compares only the runs it is given, when given some', () => {
    const baseline = ran('baseline', ['passed', 'passed', 'passed'], [], true);
    const candidate = ran(
      'candidate',
      ['failed-run', 'passed', 'failed-run'],
      [],
    );
    const compared = comparedWith(candidate, baseline, [
      RunId.of('original_1'),
      RunId.of('original_2'),
    ]);

    expect(compared.map((each) => each.original)).toEqual([
      'original_2',
      'original_1',
    ]);
    expect(compared.map((each) => each.regressed)).toEqual([true, false]);
  });

  it('has nothing to set a task against without a baseline', () => {
    const compared = comparedWith(ran('candidate', ['failed-run'], [1]), null);

    expect(compared[0]?.baseline).toBeNull();
    expect(compared[0]?.regressed).toBe(false);
    expect(compared[0]?.costDelta).toBeNull();
  });
});
