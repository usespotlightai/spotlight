import { withHunksMovedInto } from '@change-review/domain/services/cohort-hunks';
import {
  connectedGroups,
  type DiffFacts,
} from '@change-review/domain/services/diff-facts';
import { placementsOf } from '@change-review/domain/services/hunk-placements';
import { keptQuestions } from '@change-review/domain/services/shown-questions';
import { cohortProblems } from '@change-review/domain/services/stack-checks';
import type { StackParts } from '@change-review/domain/services/stack-part';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type {
  ProposedCohort,
  ProposedQuestion,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

const MAX_COMBINATIONS = 64;

export interface MovedCodeRepair {
  readonly cohort: ProposedCohort;
  readonly layerBudget: number;
}

interface MovedGroup {
  readonly hunks: readonly HunkId[];
  readonly targetAnchors: readonly HunkId[];
}

export const movedGroups = (facts: DiffFacts): HunkId[][] => {
  const moves = facts.links.filter((link) => link.kind === 'moves');

  return connectedGroups(
    [...new Set(moves.flatMap(({ from, to }) => [from, to]))],
    moves,
  );
};

const placementIndexOf = (cohort: ProposedCohort): Map<string, number[]> =>
  new Map(
    [...placementsOf([cohort])].map(([hunk, placements]) => [
      hunk,
      placements.map((each) => each.layer),
    ]),
  );

const splitIn = (
  placements: ReadonlyMap<string, readonly number[]>,
  hunks: readonly HunkId[],
): MovedGroup | null => {
  const targetAnchors = new Map<number, HunkId>();

  for (const hunk of hunks) {
    const [layer, ...again] = placements.get(hunk) ?? [];

    if (layer === undefined || again.length > 0) {
      return null;
    }
    if (!targetAnchors.has(layer)) {
      targetAnchors.set(layer, hunk);
    }
  }

  return targetAnchors.size > 1
    ? {
        hunks,
        targetAnchors: [...targetAnchors]
          .sort(([a], [b]) => b - a)
          .map(([, hunk]) => hunk),
      }
    : null;
};

const shownQuestions = (cohort: ProposedCohort): Set<ProposedQuestion> =>
  new Set(cohort.layers.flatMap((_, l) => keptQuestions(cohort, l)));

const withGroupsMoved = (
  diff: Diff,
  cohort: ProposedCohort,
  groups: readonly MovedGroup[],
  targetAnchors: readonly HunkId[],
): ProposedCohort | null =>
  groups.reduce<ProposedCohort | null>((current, group, g) => {
    const targetAnchor = targetAnchors[g];
    const target =
      current && targetAnchor !== undefined
        ? (placementIndexOf(current).get(targetAnchor)?.[0] ?? -1)
        : -1;

    return current && target >= 0
      ? withHunksMovedInto(diff, current, group.hunks, target)
      : null;
  }, cohort);

export const withMovedCodeTogether = (
  partOf: StackParts,
  moved: readonly (readonly HunkId[])[],
  cohort: ProposedCohort,
  layerBudget: number,
): MovedCodeRepair => {
  const unchanged = { cohort, layerBudget };
  const placements = placementIndexOf(cohort);
  const groups = moved.flatMap((hunks) => splitIn(placements, hunks) ?? []);

  if (
    groups.length === 0 ||
    groups.reduce((total, group) => total * group.targetAnchors.length, 1) >
      MAX_COMBINATIONS
  ) {
    return unchanged;
  }

  const part = partOf(
    cohort.layers.flatMap((layer) => layer.hunks.map((entry) => entry.hunk)),
  );
  if (
    cohortProblems(part.diff, part.facts, cohort).some(
      (each) => each.code !== 'moves',
    )
  ) {
    return unchanged;
  }

  const shown = shownQuestions(cohort);
  const best = groups
    .reduce<HunkId[][]>(
      (all, group) =>
        all.flatMap((chosen) =>
          group.targetAnchors.map((hunk) => [...chosen, hunk]),
        ),
      [[]],
    )
    .flatMap(
      (targetAnchors) =>
        withGroupsMoved(part.diff, cohort, groups, targetAnchors) ?? [],
    )
    .filter(
      (candidate) =>
        cohort.layers.length - candidate.layers.length <= layerBudget,
    )
    .sort((a, b) => b.layers.length - a.layers.length)
    .find((candidate) => {
      const stillShown = shownQuestions(candidate);

      return (
        [...shown].every((question) => stillShown.has(question)) &&
        cohortProblems(part.diff, part.facts, candidate).length === 0
      );
    });

  return best
    ? {
        cohort: best,
        layerBudget: layerBudget - (cohort.layers.length - best.layers.length),
      }
    : unchanged;
};
