import { aReplay } from '@replays/domain/replays.fake-spec';
import {
  chanceWorse,
  taskComparisons,
} from '@replays/domain/services/replay-results';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import {
  type EntryOutcome,
  ReplayOutcome,
  type ReplayOutcomeState,
} from '@replays/domain/value-objects/replay-outcome.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import fc from 'fast-check';
import { describe, it } from 'vitest';

interface Attempt {
  readonly concluded: boolean;
  readonly succeeded: boolean | null;
  readonly passedClaims: number | null;
}

interface Side {
  readonly claims: number;
  readonly referenced: boolean;
  readonly attempts: readonly Attempt[];
}

interface Task {
  readonly candidate: Side;
  readonly baseline: Side;
}

type Raise = (attempt: Attempt, claims: number) => Attempt;

const RUNS = { numRuns: 150 };

const TALLY_RUNS = { numRuns: 300 };

const BASE = aReplay({ count: 1 }).outcome();

type Lean = 'passing' | 'failing' | 'mixed';

const leaning = (lean: Lean): fc.Arbitrary<boolean> =>
  lean === 'mixed'
    ? fc.boolean()
    : fc.oneof(
        { weight: 6, arbitrary: fc.constant(lean === 'passing') },
        { weight: 1, arbitrary: fc.constant(lean !== 'passing') },
      );

const attemptOf = (claims: number, lean: Lean): fc.Arbitrary<Attempt> =>
  fc.record({
    concluded: fc.oneof(
      { weight: 30, arbitrary: fc.constant(true) },
      { weight: 1, arbitrary: fc.constant(false) },
    ),
    succeeded: fc.oneof(
      { weight: 9, arbitrary: leaning(lean) },
      { weight: 1, arbitrary: fc.constant(null) },
    ),
    passedClaims: fc.oneof(
      {
        weight: 6,
        arbitrary: fc
          .array(leaning(lean), { minLength: claims, maxLength: claims })
          .map((passed) => passed.filter(Boolean).length),
      },
      { weight: 1, arbitrary: fc.constant(null) },
    ),
  });

const sideOf = (claims: number, referenced: boolean): fc.Arbitrary<Side> =>
  fc
    .constantFrom<Lean>('passing', 'failing', 'mixed')
    .chain((lean) =>
      fc.array(attemptOf(claims, lean), { minLength: 1, maxLength: 6 }),
    )
    .map((attempts) => ({ claims, referenced, attempts }));

const task: fc.Arbitrary<Task> = fc
  .record({
    claims: fc.integer({ min: 1, max: 6 }),
    referenced: fc.boolean(),
  })
  .chain(({ claims, referenced }) =>
    fc.record({
      candidate: sideOf(claims, referenced),
      baseline: sideOf(claims, referenced),
    }),
  );

const tasks = fc.array(task, { minLength: 1, maxLength: 4 });

const originalOf = (at: number) => RunId.of(`original_${at}`);

const entriesOf = (
  sides: readonly Side[],
  replay: string,
): readonly EntryOutcome[] =>
  sides.flatMap((side, at) =>
    side.attempts.map((attempt, repeat) => ({
      position: at * 10 + repeat,
      original: originalOf(at),
      taskId: TaskId.of(`task_${at}`),
      repeat: repeat + 1,
      run: RunId.of(`${replay}_run_${at}_${repeat}`),
      hasEnded: true,
      ending: 'completed',
      concluded: attempt.concluded,
      succeeded: attempt.succeeded,
      reasons: [],
      measures: { steps: 10, ms: 60_000, cost: null },
      verdict:
        attempt.passedClaims === null
          ? null
          : {
              value: attempt.passedClaims / side.claims,
              referenced: side.referenced,
            },
      pair: null,
      secondJudging: null,
      judgeAgreed: null,
      checks: null,
      recheck: null,
      checksFlipped: null,
      spent: ModelSpent.none(),
    })),
  );

const stateOf = (
  sides: readonly Side[],
  replay: string,
): ReplayOutcomeState => ({
  id: BASE.id,
  setId: BASE.setId,
  candidateId: BASE.candidateId,
  searchId: BASE.searchId,
  current: BASE.current,
  startedAt: BASE.startedAt,
  endedAt: BASE.endedAt,
  repeats: Math.max(...sides.map((side) => side.attempts.length)),
  calibration: BASE.calibration,
  servesAsBaseline: BASE.servesAsBaseline,
  healthSampleGroup: BASE.healthSampleGroup,
  sampledAt: BASE.sampledAt,
  rubricVersion: BASE.rubricVersion,
  currency: BASE.currency,
  runSubset: null,
  referenceReplayId: null,
  pairwiseReferenceId: null,
  originals: sides.map((_, at) => originalOf(at)),
  entries: entriesOf(sides, replay),
});

const outcomeOf = (sides: readonly Side[], replay: string): ReplayOutcome =>
  ReplayOutcome.of(stateOf(sides, replay));

const regressedIn = (
  candidate: readonly Side[],
  baseline: readonly Side[],
): readonly string[] =>
  taskComparisons(
    outcomeOf(candidate, 'candidate'),
    outcomeOf(baseline, 'baseline'),
  )
    .filter((each) => each.regressed)
    .map((each) => each.original)
    .sort();

const regressedTasks = (each: readonly Task[]): readonly string[] =>
  regressedIn(
    each.map((one) => one.candidate),
    each.map((one) => one.baseline),
  );

const sameList = (one: readonly string[], other: readonly string[]) =>
  one.length === other.length && one.every((each, at) => each === other[at]);

const passing: Raise = (attempt) =>
  attempt.succeeded === false ? { ...attempt, succeeded: true } : attempt;

const scoredHigher: Raise = (attempt, claims) =>
  attempt.passedClaims === null
    ? attempt
    : { ...attempt, passedClaims: Math.min(claims, attempt.passedClaims + 1) };

const raise = fc.constantFrom<Raise>(passing, scoredHigher);

const raisedIn = (
  side: Side,
  raised: readonly boolean[],
  how: Raise,
): Side => ({
  ...side,
  attempts: side.attempts.map((attempt, at) =>
    raised[at % raised.length] ? how(attempt, side.claims) : attempt,
  ),
});

const flags = fc.array(fc.boolean(), { minLength: 1, maxLength: 6 });

const tally = fc.integer({ min: 1, max: 12 }).chain((trials) =>
  fc.record({
    trials: fc.constant(trials),
    successes: fc.oneof(
      fc.integer({ min: 0, max: trials }),
      fc.integer({ min: 0, max: trials * 6 }).map((share) => share / 6),
    ),
  }),
);

const NEAR = 1e-9;

describe('chanceWorse under any two tallies of attempts', () => {
  it('puts a tally against itself at even odds', () => {
    fc.assert(
      fc.property(
        tally,
        (each) => Math.abs(chanceWorse(each, each) - 0.5) < NEAR,
      ),
      TALLY_RUNS,
    );
  });

  it('gives the two orders chances that add up to one', () => {
    fc.assert(
      fc.property(
        tally,
        tally,
        (one, other) =>
          Math.abs(chanceWorse(one, other) + chanceWorse(other, one) - 1) <
          NEAR,
      ),
      TALLY_RUNS,
    );
  });

  it('never makes a candidate likelier worse for succeeding more often', () => {
    fc.assert(
      fc.property(
        tally,
        tally,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (candidate, baseline, more) => {
          const raised = {
            trials: candidate.trials,
            successes:
              candidate.successes +
              more * (candidate.trials - candidate.successes),
          };

          return (
            chanceWorse(raised, baseline) <=
            chanceWorse(candidate, baseline) + NEAR
          );
        },
      ),
      TALLY_RUNS,
    );
  });
});

describe('taskComparisons under any judged attempts on both sides', () => {
  it('calls no task a regression where the candidate did exactly what the baseline did', () => {
    fc.assert(
      fc.property(tasks, (each) => {
        const sides = each.map((one) => one.baseline);

        return regressedIn(sides, sides).length === 0;
      }),
      RUNS,
    );
  });

  it('never makes a task a regression by passing more attempts or scoring higher', () => {
    fc.assert(
      fc.property(tasks, flags, raise, (each, raised, how) => {
        const before = regressedTasks(each);
        const after = regressedTasks(
          each.map((one) => ({
            ...one,
            candidate: raisedIn(one.candidate, raised, how),
          })),
        );

        return after.every((original) => before.includes(original));
      }),
      RUNS,
    );
  });

  it('never makes a task a regression by the baseline passing fewer attempts or scoring lower', () => {
    fc.assert(
      fc.property(tasks, flags, raise, (each, raised, how) => {
        const higher = regressedTasks(
          each.map((one) => ({
            ...one,
            baseline: raisedIn(one.baseline, raised, how),
          })),
        );

        return regressedTasks(each).every((original) =>
          higher.includes(original),
        );
      }),
      RUNS,
    );
  });

  it('never calls a task a regression both ways, when the two differ on one measure only', () => {
    const unjudged = (side: Side): Side => ({
      ...side,
      attempts: side.attempts.map((attempt) => ({
        ...attempt,
        passedClaims: null,
      })),
    });
    const allPassing = (side: Side): Side => ({
      ...side,
      attempts: side.attempts.map((attempt) => ({
        ...attempt,
        succeeded: true,
      })),
    });

    fc.assert(
      fc.property(tasks, fc.boolean(), (each, bySuccess) => {
        const only = bySuccess ? unjudged : allPassing;
        const ours = each.map((one) => only(one.candidate));
        const theirs = each.map((one) => only(one.baseline));
        const oneWay = regressedIn(ours, theirs);

        return regressedIn(theirs, ours).every(
          (original) => !oneWay.includes(original),
        );
      }),
      RUNS,
    );
  });

  it('compares the same way whatever order the entries come in', () => {
    const shuffledTasks = tasks.chain((each) => {
      const count = each.reduce(
        (sum, one) => sum + one.candidate.attempts.length,
        0,
      );

      return fc.tuple(
        fc.constant(each),
        fc.shuffledSubarray(
          Array.from({ length: count }, (_, at) => at),
          { minLength: count, maxLength: count },
        ),
      );
    });

    fc.assert(
      fc.property(shuffledTasks, ([each, order]) => {
        const candidate = stateOf(
          each.map((one) => one.candidate),
          'candidate',
        );
        const baseline = outcomeOf(
          each.map((one) => one.baseline),
          'baseline',
        );
        const listed = (entries: readonly EntryOutcome[]) =>
          taskComparisons(
            ReplayOutcome.of({ ...candidate, entries }),
            baseline,
          ).map((one) => `${one.original} ${one.position} ${one.regressed}`);

        return sameList(
          listed(candidate.entries),
          listed(order.flatMap((at) => candidate.entries.slice(at, at + 1))),
        );
      }),
      RUNS,
    );
  });

  it('leaves the other tasks as they were when one more task is compared', () => {
    fc.assert(
      fc.property(tasks, task, (each, added) => {
        const before = regressedTasks(each);
        const after = regressedTasks([...each, added]).filter(
          (original) => original !== `original_${each.length}`,
        );

        return sameList(before, after);
      }),
      RUNS,
    );
  });
});
