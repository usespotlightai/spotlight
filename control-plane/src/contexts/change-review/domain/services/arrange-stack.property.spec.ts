import { isDeepStrictEqual } from 'node:util';

import { arranged } from '@change-review/domain/services/arrange-stack';
import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import {
  dependsOnlyBackward,
  diffOf,
  drawnFile,
  eachOnce,
  factsOf,
  hasEmptyLayer,
  layersOf,
  placedHunks,
  type ProposedStack,
  proposedStack,
} from '@change-review/domain/services/proposed-stack.fake-spec';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { optionalItems } from '@change-review/testing/optional-items.fake-spec';
import fc from 'fast-check';
import { describe, it } from 'vitest';

const RUNS = { numRuns: 1_000 };

const arrangedOf = ({ diff, facts, cohorts }: ProposedStack) =>
  arranged(diff, facts, cohorts);

const incidentalIn = (facts: DiffFacts): readonly string[] =>
  facts.hunks.filter((each) => each.incidental).map((each) => each.hunk);

const placesOf = (
  cohorts: readonly ProposedCohort[],
): ReadonlyMap<string, string> =>
  new Map(
    cohorts.flatMap((cohort) =>
      cohort.layers.flatMap((layer) =>
        layer.hunks.map((entry): [string, string] => [
          entry.hunk,
          cohort.kind === 'incidental'
            ? 'incidental'
            : `${cohort.title} / ${layer.title}`,
        ]),
      ),
    ),
  );

const orderOf = (
  cohorts: readonly ProposedCohort[],
): ReadonlyMap<string, readonly [number, number]> =>
  new Map(
    cohorts.flatMap((cohort, c) =>
      layersOf(cohort).flatMap((hunks, l) =>
        hunks.map((hunk): [string, readonly [number, number]] => [
          hunk,
          [c, l],
        ]),
      ),
    ),
  );

const sameOrder = (
  one: readonly [number, number] | undefined,
  other: readonly [number, number] | undefined,
): number =>
  one && other ? Math.sign(one[0] - other[0] || one[1] - other[1]) : NaN;

describe('arranged under any proposal and any incidental hunks', () => {
  it('places every hunk of the diff exactly once', () => {
    fc.assert(
      fc.property(proposedStack, (stack) =>
        eachOnce(
          placedHunks(arrangedOf(stack)),
          stack.diff.hunks.map((hunk) => hunk.id),
        ),
      ),
      RUNS,
    );
  });

  it('leaves no layer empty, and each layer depending only on layers before it', () => {
    fc.assert(
      fc.property(proposedStack, (stack) => {
        const cohorts = arrangedOf(stack);

        return !hasEmptyLayer(cohorts) && cohorts.every(dependsOnlyBackward);
      }),
      RUNS,
    );
  });

  it('puts the incidental hunks, and only those, in one last cohort in the order of the diff', () => {
    fc.assert(
      fc.property(proposedStack, (stack) => {
        const cohorts = arrangedOf(stack);
        const incidental = incidentalIn(stack.facts);
        const [last] = optionalItems(cohorts.slice(-1));
        const rest = incidental.length > 0 ? cohorts.slice(0, -1) : cohorts;

        return (
          rest.every((cohort) => cohort.kind === 'change') &&
          isDeepStrictEqual(
            last?.kind === 'incidental' ? placedHunks([last]) : [],
            incidental,
          )
        );
      }),
      RUNS,
    );
  });

  it('keeps every other hunk in the order of cohorts and layers it was proposed in', () => {
    fc.assert(
      fc.property(proposedStack, (stack) => {
        const before = orderOf(stack.cohorts);
        const after = orderOf(arrangedOf(stack));
        const incidental = incidentalIn(stack.facts);
        const staying = [...before.keys()].filter(
          (hunk) => !incidental.includes(hunk),
        );

        return staying.every((one) =>
          staying.every(
            (other) =>
              sameOrder(before.get(one), before.get(other)) ===
              sameOrder(after.get(one), after.get(other)),
          ),
        );
      }),
      RUNS,
    );
  });

  it('changes nothing when it arranges what it arranged', () => {
    fc.assert(
      fc.property(proposedStack, (stack) => {
        const once = arrangedOf(stack);

        return isDeepStrictEqual(arrangedOf({ ...stack, cohorts: once }), once);
      }),
      RUNS,
    );
  });

  it('places the hunks the same whatever order the facts come in', () => {
    fc.assert(
      fc.property(
        proposedStack.chain((stack) =>
          fc
            .shuffledSubarray([...stack.facts.hunks], {
              minLength: stack.facts.hunks.length,
              maxLength: stack.facts.hunks.length,
            })
            .map((hunks) => ({ stack, hunks })),
        ),
        ({ stack, hunks }) =>
          isDeepStrictEqual(
            arrangedOf(stack).map(layersOf),
            arrangedOf({ ...stack, facts: { ...stack.facts, hunks } }).map(
              layersOf,
            ),
          ),
      ),
      RUNS,
    );
  });

  it('moves no hunk it placed when the diff gains a file', () => {
    fc.assert(
      fc.property(proposedStack, drawnFile, (stack, added) => {
        const files = [...stack.files, added];
        const diff = diffOf(files);
        const facts = factsOf(diff, files);
        const [file] = optionalItems(diff.files.slice(-1));
        const hunks = file?.hunks.map((hunk) => ({ hunk: hunk.id })) ?? [];
        const own: ProposedCohort = {
          kind: 'change',
          title: 'The added file',
          intent: 'The added file changes.',
          layers: [
            {
              title: 'The added file',
              summary: 'The added file changes.',
              dependsOn: [],
              hunks,
              notes: file ? [{ path: file.path, note: 'Added.' }] : [],
              questions: [],
            },
          ],
        };
        const before = placesOf(arrangedOf(stack));
        const after = placesOf(arranged(diff, facts, [...stack.cohorts, own]));

        return [...before].every(([hunk, place]) => after.get(hunk) === place);
      }),
      RUNS,
    );
  });
});
