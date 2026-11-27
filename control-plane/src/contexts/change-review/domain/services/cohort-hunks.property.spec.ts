import { isDeepStrictEqual } from 'node:util';

import {
  withHunksMovedInto,
  withoutHunks,
} from '@change-review/domain/services/cohort-hunks';
import {
  type CohortInDiff,
  cohortInDiff,
  dependsOnlyBackward,
  eachOnce,
  hasEmptyLayer,
  layersOf,
  placedHunks,
} from '@change-review/domain/services/proposed-stack.fake-spec';
import { keptQuestions } from '@change-review/domain/services/shown-questions';
import type {
  ProposedCohort,
  ProposedQuestion,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { optionalItems } from '@change-review/testing/optional-items.fake-spec';
import fc from 'fast-check';
import { describe, it } from 'vitest';

interface Taking extends CohortInDiff {
  readonly leaving: readonly HunkId[];
}

interface Moving extends Taking {
  readonly target: number;
}

const RUNS = { numRuns: 1_000 };

const hunksIn = (cohort: ProposedCohort): HunkId[] => [
  ...placedHunks([cohort]),
];

const taking: fc.Arbitrary<Taking> = cohortInDiff.chain((drawn) =>
  fc.subarray(hunksIn(drawn.cohort)).map((leaving) => ({ ...drawn, leaving })),
);

const moving: fc.Arbitrary<Moving> = cohortInDiff.chain((drawn) =>
  fc.record({
    diff: fc.constant(drawn.diff),
    cohort: fc.constant(drawn.cohort),
    leaving: fc.subarray(hunksIn(drawn.cohort), { minLength: 1 }),
    target: fc.integer({ min: 0, max: drawn.cohort.layers.length - 1 }),
  }),
);

const reordered = <T>(items: readonly T[]): fc.Arbitrary<T[]> =>
  fc.shuffledSubarray([...items], {
    minLength: items.length,
    maxLength: items.length,
  });

const layerOfEach = (cohort: ProposedCohort): ReadonlyMap<string, number> =>
  new Map(
    layersOf(cohort).flatMap((hunks, at) =>
      hunks.map((hunk): [string, number] => [hunk, at]),
    ),
  );

const keepsOrderOf = (
  before: ProposedCohort,
  after: ProposedCohort,
  moved: readonly string[],
): boolean => {
  const was = layerOfEach(before);
  const is = layerOfEach(after);
  const staying = [...was.keys()].filter((hunk) => !moved.includes(hunk));

  return staying.every((one) =>
    staying.every(
      (other) =>
        Math.sign((was.get(one) ?? 0) - (was.get(other) ?? 0)) ===
        Math.sign((is.get(one) ?? 0) - (is.get(other) ?? 0)),
    ),
  );
};

const keyOf = (question: ProposedQuestion): string =>
  JSON.stringify([question.question, question.answer, question.hunks]);

const shownQuestionsOf = (cohort: ProposedCohort): ReadonlySet<string> =>
  new Set(
    cohort.layers.flatMap((_, at) => keptQuestions(cohort, at).map(keyOf)),
  );

const movedInto = ({ diff, cohort, leaving, target }: Moving) =>
  withHunksMovedInto(diff, cohort, leaving, target);

describe('withoutHunks under any cohort and any hunks taken out', () => {
  it('keeps every other hunk once and in its order, and none it takes out', () => {
    fc.assert(
      fc.property(taking, ({ diff, cohort, leaving }) => {
        const left = withoutHunks(diff, cohort, leaving);

        return isDeepStrictEqual(
          left ? placedHunks([left]) : [],
          hunksIn(cohort).filter((hunk) => !leaving.includes(hunk)),
        );
      }),
      RUNS,
    );
  });

  it('leaves nothing of the cohort only when every hunk goes', () => {
    fc.assert(
      fc.property(
        taking,
        ({ diff, cohort, leaving }) =>
          (withoutHunks(diff, cohort, leaving) === null) ===
          hunksIn(cohort).every((hunk) => leaving.includes(hunk)),
      ),
      RUNS,
    );
  });

  it('leaves no layer empty, and each layer depending only on layers before it', () => {
    fc.assert(
      fc.property(taking, ({ diff, cohort, leaving }) => {
        const left = withoutHunks(diff, cohort, leaving);

        return (
          left === null || (!hasEmptyLayer([left]) && dependsOnlyBackward(left))
        );
      }),
      RUNS,
    );
  });

  it('takes the same out whatever order the hunks are named in', () => {
    fc.assert(
      fc.property(
        taking.chain((drawn) =>
          reordered(drawn.leaving).map((other) => ({ ...drawn, other })),
        ),
        ({ diff, cohort, leaving, other }) =>
          isDeepStrictEqual(
            withoutHunks(diff, cohort, leaving),
            withoutHunks(diff, cohort, other),
          ),
      ),
      RUNS,
    );
  });

  it('takes hunks out in two steps as it takes them out in one', () => {
    fc.assert(
      fc.property(
        taking.chain((drawn) =>
          fc
            .subarray(hunksIn(drawn.cohort))
            .map((later) => ({ ...drawn, later })),
        ),
        ({ diff, cohort, leaving, later }) => {
          const first = withoutHunks(diff, cohort, leaving);
          const twice = first && withoutHunks(diff, first, later);

          return isDeepStrictEqual(
            twice,
            first && withoutHunks(diff, cohort, [...leaving, ...later]),
          );
        },
      ),
      RUNS,
    );
  });
});

describe('withHunksMovedInto under any cohort, hunks and target layer', () => {
  it('holds each hunk once, with every moved hunk in the target layer', () => {
    fc.assert(
      fc.property(moving, (drawn) => {
        const moved = movedInto(drawn);
        const target = optionalItems(drawn.cohort.layers)[drawn.target];
        const emptiedBefore = drawn.cohort.layers
          .slice(0, drawn.target)
          .filter((layer) =>
            layer.hunks.every((entry) => drawn.leaving.includes(entry.hunk)),
          ).length;
        const into = moved && layersOf(moved)[drawn.target - emptiedBefore];

        return (
          moved === null ||
          (target !== undefined &&
            eachOnce(placedHunks([moved]), hunksIn(drawn.cohort)) &&
            drawn.leaving.every((hunk) => into?.includes(hunk) === true))
        );
      }),
      RUNS,
    );
  });

  it('leaves no layer empty, and each layer depending only on layers before it', () => {
    fc.assert(
      fc.property(moving, (drawn) => {
        const moved = movedInto(drawn);

        return (
          moved === null ||
          (!hasEmptyLayer([moved]) && dependsOnlyBackward(moved))
        );
      }),
      RUNS,
    );
  });

  it('keeps the order of the layers of every hunk that does not move', () => {
    fc.assert(
      fc.property(moving, (drawn) => {
        const moved = movedInto(drawn);

        return (
          moved === null || keepsOrderOf(drawn.cohort, moved, drawn.leaving)
        );
      }),
      RUNS,
    );
  });

  it('carries a question to another layer only when it was shown before the move', () => {
    fc.assert(
      fc.property(moving, (drawn) => {
        const moved = movedInto(drawn);
        const shown = shownQuestionsOf(drawn.cohort);
        const askedOn = new Map(
          drawn.cohort.layers.flatMap((layer) =>
            layer.questions.map((question): [string, string] => [
              keyOf(question),
              layer.title,
            ]),
          ),
        );

        return (
          moved === null ||
          moved.layers.every((layer) =>
            layer.questions.every(
              (question) =>
                askedOn.get(keyOf(question)) === layer.title ||
                shown.has(keyOf(question)),
            ),
          )
        );
      }),
      RUNS,
    );
  });

  it('puts every hunk in the same layer whatever order the hunks are named in', () => {
    fc.assert(
      fc.property(
        moving.chain((drawn) =>
          reordered(drawn.leaving).map((other) => ({ ...drawn, other })),
        ),
        (drawn) => {
          const moved = movedInto(drawn);
          const again = movedInto({ ...drawn, leaving: drawn.other });

          return (
            (moved === null) === (again === null) &&
            isDeepStrictEqual(
              moved && layerOfEach(moved),
              again && layerOfEach(again),
            ) &&
            isDeepStrictEqual(
              moved?.layers.map((layer) => layer.dependsOn),
              again?.layers.map((layer) => layer.dependsOn),
            )
          );
        },
      ),
      RUNS,
    );
  });

  it('changes nothing when the hunks already sit in the target layer', () => {
    fc.assert(
      fc.property(
        cohortInDiff.chain((drawn) =>
          fc
            .integer({ min: 0, max: drawn.cohort.layers.length - 1 })
            .chain((target) =>
              fc
                .subarray([...(layersOf(drawn.cohort)[target] ?? [])], {
                  minLength: 1,
                })
                .map((leaving) => ({ ...drawn, target, leaving })),
            ),
        ),
        ({ diff, cohort, leaving, target }) =>
          isDeepStrictEqual(
            withHunksMovedInto(diff, cohort, leaving, target),
            cohort,
          ),
      ),
      RUNS,
    );
  });
});
