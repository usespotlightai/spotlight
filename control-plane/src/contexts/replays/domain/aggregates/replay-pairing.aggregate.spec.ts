import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import { ReplayPairingRequested } from '@replays/domain/events/replay-pairing-requested.event';
import { ReplaySideBySideJudgingRequested } from '@replays/domain/events/replay-side-by-side-judging-requested.event';
import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import {
  aReplay,
  BY,
  CONCLUDING_CHECKS,
  CONCLUDING_VERDICT,
  candidateOf,
  concludedAll,
  endOf,
  FINGERPRINT,
  later,
  measuresOf,
  NOW,
  pairVerdictOf,
  RUBRIC,
  runOf,
} from '@replays/domain/replays.fake-spec';
import {
  pairOutcomeOf,
  pairTallyOf,
  taskComparisons,
} from '@replays/domain/services/replay-results';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const judging = (id: string, repeats = 1, ceiling = 10) =>
  aReplay({
    id,
    count: 2,
    repeats,
    ceiling,
    pairwiseReferenceId: 'baseline_1',
    candidate: candidateOf('proposed', 'candidate_proposed', RUBRIC),
  });

const baseline = (repeats = 1) =>
  aReplay({
    id: 'baseline_1',
    count: 2,
    repeats,
    baseline: true,
    candidate: candidateOf('live', 'candidate_live', RUBRIC),
  });

const everyOriginal = () => true;

describe('Replay, set side by side with its baseline', () => {
  it('says when one of its entries concludes', () => {
    let replay = judging('replay_1').reserving(
      2,
      (() => {
        let at = 0;
        return () => runOf('replay_1', at++);
      })(),
    );
    const run = runOf('replay_1', 0);

    replay = replay
      .confirm(run, FINGERPRINT, NOW)
      .recordRunEnd(run, endOf('completed'))
      .measure(run, measuresOf(1), later(61_000))
      .recordReview(run, CONCLUDING_CHECKS, null, later(62_000));
    replay.pullEvents();

    const judged = replay.recordVerdict(
      run,
      CONCLUDING_VERDICT,
      null,
      later(63_000),
    );

    expect(judged.pullEvents()).toContainEqual(
      new ReplayEntryConcluded(
        judged.id,
        judged.workspaceId,
        judged.setId,
        run,
      ),
    );
  });

  it('requests a side-by-side judging for every concluded change beside the baseline’s for the same task, once', () => {
    const replay = concludedAll(judging('replay_1'));
    const against = concludedAll(baseline());

    const paired = replay.pairAgainst(against, everyOriginal);

    expect(paired.pullEvents()).toEqual(
      [0, 1].map(
        (at) =>
          new ReplaySideBySideJudgingRequested(
            replay.id,
            replay.workspaceId,
            replay.candidateId,
            runOf('replay_1', at),
            runOf('baseline_1', at),
            RunId.of(`original_${at}`),
          ),
      ),
    );
    expect(paired.entries.every((each) => each.pairing?.pending)).toBe(true);
    expect(paired.pairAgainst(against, everyOriginal)).toBe(paired);
  });

  it('sets repeat k beside the baseline’s repeat k, else beside its first repeat', () => {
    const paired = concludedAll(judging('replay_1', 2)).pairAgainst(
      concludedAll(baseline(1)),
      everyOriginal,
    );

    expect(
      paired.entries.map((each) => [
        each.original.value,
        each.repeat,
        each.pairing?.otherRunId.value,
      ]),
    ).toEqual([
      ['original_0', 1, 'baseline_1_run_0'],
      ['original_1', 1, 'baseline_1_run_1'],
      ['original_0', 2, 'baseline_1_run_0'],
      ['original_1', 2, 'baseline_1_run_1'],
    ]);
  });

  it('requests nothing for a task with no accepted change, no change on either side, or a side not yet concluded', () => {
    const replay = concludedAll(judging('replay_1'));

    expect(
      replay.pairAgainst(concludedAll(baseline()), (original) =>
        original.equals(RunId.of('original_0')),
      ).entries[1]?.pairing,
    ).toBeNull();
    expect(
      replay.pairAgainst(
        concludedAll(baseline(), { changedLines: 0 }),
        everyOriginal,
      ),
    ).toBe(replay);
    expect(
      concludedAll(judging('replay_1'), { changedLines: 0 }).pairAgainst(
        concludedAll(baseline()),
        everyOriginal,
      ).entries[0]?.pairing,
    ).toBeNull();
    expect(
      replay.pairAgainst(
        concludedAll(baseline(), { judged: false }),
        everyOriginal,
      ),
    ).toBe(replay);
  });

  it('is never set beside itself, nor is a baseline set beside anything, nor a replay without a judge', () => {
    const replay = concludedAll(judging('replay_1'));
    const against = concludedAll(baseline());

    expect(replay.pairAgainst(replay, everyOriginal)).toBe(replay);
    expect(against.pairAgainst(replay, everyOriginal)).toBe(against);
    expect(
      concludedAll(aReplay({ id: 'unjudged', count: 2 })).pairAgainst(
        against,
        everyOriginal,
      ).entries[0]?.pairing,
    ).toBeNull();
  });

  it('requests nothing once its spend reached its ceiling', () => {
    const replay = concludedAll(judging('replay_1', 1, 2));

    expect(replay.pairAgainst(concludedAll(baseline()), everyOriginal)).toBe(
      replay,
    );
  });

  it('requests only as many as its headroom allows, reserving twice each entry’s judging cost per attempt it pays for, and requests again once a verdict frees room', () => {
    const replay = concludedAll(judging('replay_1', 1, 4), {
      judgingCost: 0.25,
    });
    const against = concludedAll(baseline());

    const paired = replay.pairAgainst(against, everyOriginal);

    expect(paired.entries.map((each) => each.pairing?.pending ?? null)).toEqual(
      [true, null],
    );
    expect(paired.pairAgainst(against, everyOriginal)).toBe(paired);

    const answered = paired.pair(
      runOf('replay_1', 0),
      runOf('baseline_1', 0),
      pairVerdictOf('run'),
      ModelSpent.of([Money.of(0.1, 'USD')], 0),
    );

    expect(answered.pullEvents()).toContainEqual(
      new ReplayPairingRequested(answered.id, answered.workspaceId),
    );
    expect(
      answered.pairAgainst(against, everyOriginal).entries[1]?.pairing?.pending,
    ).toBe(true);
  });

  it('leaves an entry out at its ceiling once nothing it waits on can free room', () => {
    const replay = concludedAll(judging('replay_1', 1, 3), {
      judgingCost: 0.25,
    });

    expect(
      replay
        .pairAgainst(concludedAll(baseline()), everyOriginal)
        .entries.map((each) => each.pairing?.unpaired),
    ).toEqual(['ceiling-reached', 'ceiling-reached']);
  });

  it('leaves its entries unpaired, saying so, against a replay judged by another rubric', () => {
    const other = concludedAll(
      aReplay({
        id: 'baseline_1',
        count: 2,
        baseline: true,
        candidate: candidateOf('live', 'candidate_live', 'Another rubric.'),
      }),
    );

    expect(
      concludedAll(judging('replay_1'))
        .pairAgainst(other, everyOriginal)
        .entries.map((each) => each.pairing?.unpaired),
    ).toEqual(['other-rubric', 'other-rubric']);
  });

  it('takes no pairing while it still runs', () => {
    const running = judging('replay_1').reserving(2, () =>
      RunId.of(`running_${Math.random()}`),
    );

    expect(running.takesPairings).toBe(false);
    expect(running.pairAgainst(concludedAll(baseline()), everyOriginal)).toBe(
      running,
    );
  });

  it('records what pairing spent in its charge against the ceiling, but out of what it spent on its runs', () => {
    const requested = concludedAll(judging('replay_1')).pairAgainst(
      concludedAll(baseline()),
      everyOriginal,
    );
    const paired = requested.pair(
      runOf('replay_1', 0),
      runOf('baseline_1', 0),
      pairVerdictOf('run'),
      ModelSpent.of([Money.of(0.25, 'USD')], 0),
    );

    expect(paired.spent.equals(requested.spent)).toBe(true);
    expect(paired.charged.amount).toBeCloseTo(requested.charged.amount + 0.25);
  });

  it('is set beside only the replay it started paired with', () => {
    const replay = concludedAll(judging('replay_1'));
    const other = concludedAll(
      aReplay({
        id: 'baseline_2',
        count: 2,
        baseline: true,
        candidate: candidateOf('live', 'candidate_live', RUBRIC),
      }),
    );

    expect(replay.pairAgainst(other, everyOriginal)).toBe(replay);
    expect(replay.pairwiseReferenceId?.value).toBe('baseline_1');
  });

  it('takes no pairing once stopped or over its budget, but still once finished', () => {
    const finished = concludedAll(judging('replay_1'));
    const stopped = judging('replay_1').stop(NOW, BY);

    expect(finished.current).toBe('finished');
    expect(finished.takesPairings).toBe(true);
    expect(stopped.takesPairings).toBe(false);
    expect(stopped.pairAgainst(concludedAll(baseline()), everyOriginal)).toBe(
      stopped,
    );
  });

  it('starts paired with the baseline it wants, and never as a baseline or a calibration', () => {
    expect(() =>
      aReplay({
        id: 'baseline_1',
        baseline: true,
        pairwiseReferenceId: 'baseline_0',
        candidate: candidateOf('live', 'candidate_live', RUBRIC),
      }),
    ).toThrow(InvalidReplayError);
    expect(() => judging('baseline_1')).toThrow(InvalidReplayError);
  });

  it('records the verdict and what it cost against its ceiling, without changing whether the run succeeded', () => {
    const requested = concludedAll(judging('replay_1')).pairAgainst(
      concludedAll(baseline()),
      everyOriginal,
    );
    const run = runOf('replay_1', 0);
    const succeeded = requested.entries[0]?.succeeded;
    const chargedBefore = requested.charged.amount;

    const paired = requested.pair(
      run,
      runOf('baseline_1', 0),
      pairVerdictOf('run'),
      ModelSpent.of([Money.of(0.25, 'USD')], 0),
    );

    expect(paired.entries[0]?.pairing?.verdict?.outcome).toBe('win');
    expect(paired.entries[0]?.succeeded).toBe(succeeded);
    expect(paired.charged.amount).toBeCloseTo(chargedBefore + 0.25);
    expect(
      paired.pair(run, runOf('baseline_1', 1), pairVerdictOf('other'), null),
    ).toBe(paired);
  });

  it('records why a side-by-side judging failed', () => {
    const failed = concludedAll(judging('replay_1'))
      .pairAgainst(concludedAll(baseline()), everyOriginal)
      .recordPairingFailure(
        runOf('replay_1', 1),
        runOf('baseline_1', 1),
        'no-evidence',
        null,
      );

    expect(failed.entries[1]?.pairing?.unpaired).toBe('no-evidence');
    expect(failed.entries[1]?.pairing?.pending).toBe(false);
  });
});

const pairedAs = (
  replay: Replay,
  against: Replay,
  winners: readonly ('run' | 'other' | 'tie')[],
): Replay => {
  const requested = replay.pairAgainst(against, everyOriginal);

  return requested.entries.reduce(
    (built, entry, at) =>
      built.pair(
        entry.run as RunId,
        entry.pairing?.otherRunId as RunId,
        pairVerdictOf(winners[at] ?? 'tie'),
        null,
      ),
    requested,
  );
};

describe('pairOutcomeOf and pairTallyOf', () => {
  it('reads each task’s side-by-side verdict against the replay it started paired with, and tallies wins, losses and ties', () => {
    const against = concludedAll(baseline());
    const paired = pairedAs(concludedAll(judging('replay_1')), against, [
      'run',
      'other',
    ]);

    expect(
      taskComparisons(paired, against).map((each) => [
        each.original,
        each.pair,
      ]),
    ).toEqual([
      ['original_0', 'win'],
      ['original_1', 'loss'],
    ]);
    expect(pairTallyOf(paired)).toEqual({ wins: 1, losses: 1, ties: 0 });
    expect(pairTallyOf(paired, [RunId.of('original_0')])).toEqual({
      wins: 1,
      losses: 0,
      ties: 0,
    });
  });

  it('keeps its verdicts though a newer baseline is available for comparison', () => {
    const paired = pairedAs(
      concludedAll(judging('replay_1')),
      concludedAll(baseline()),
      ['run', 'run'],
    );
    const newer = concludedAll(
      aReplay({
        id: 'baseline_2',
        count: 2,
        baseline: true,
        candidate: candidateOf('live', 'candidate_live', RUBRIC),
      }),
    );

    expect(taskComparisons(paired, newer).map((each) => each.pair)).toEqual([
      'win',
      'win',
    ]);
    expect(pairTallyOf(paired)).toEqual({ wins: 2, losses: 0, ties: 0 });
  });

  it('tallies nothing for a replay paired with none', () => {
    expect(pairTallyOf(concludedAll(baseline()))).toBeNull();
  });

  it('goes by most of a task’s repeats, and calls an even split a tie', () => {
    const against = concludedAll(baseline(2));
    const paired = pairedAs(concludedAll(judging('replay_1', 2)), against, [
      'run',
      'run',
      'run',
      'other',
    ]);
    const [first, second] = [0, 1].map((original) =>
      paired.entries.filter(
        (each) => each.original.value === `original_${original}`,
      ),
    );

    expect(pairOutcomeOf(first ?? [])).toBe('win');
    expect(pairOutcomeOf(second ?? [])).toBe('tie');
    expect(pairOutcomeOf(concludedAll(judging('replay_2')).entries)).toBeNull();
  });
});
