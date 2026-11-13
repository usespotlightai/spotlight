import { withHunksMovedInto } from '@change-review/domain/services/cohort-hunks';
import {
  definitionsOf,
  type HunkLink,
} from '@change-review/domain/services/diff-facts';
import { onlyLayersOf } from '@change-review/domain/services/hunk-placements';
import { keepsEveryQuestion } from '@change-review/domain/services/shown-questions';
import { cohortProblems } from '@change-review/domain/services/stack-checks';
import type { StackParts } from '@change-review/domain/services/stack-part';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

export interface TestPlacementRepair {
  readonly cohort: ProposedCohort;
  readonly layerBudget: number;
}

const REPAIRS_ALONGSIDE = new Set(['tests', 'moves']);

const misplacedTests = (
  links: readonly HunkLink[],
  layers: ReadonlyMap<string, number>,
): { test: HunkId; anchor: HunkId }[] => {
  const anchors = new Map<HunkId, HunkId>();

  for (const link of links) {
    if (link.kind !== 'tests' || !layers.has(link.to)) {
      continue;
    }

    const current = anchors.get(link.from);

    if (
      current === undefined ||
      (layers.get(link.to) ?? -1) > (layers.get(current) ?? -1)
    ) {
      anchors.set(link.from, link.to);
    }
  }

  return [...anchors]
    .filter(
      ([test, anchor]) =>
        layers.has(test) && layers.get(test) !== layers.get(anchor),
    )
    .map(([test, anchor]) => ({ test, anchor }));
};

export const withTestsBesideTheirCode = (
  partOf: StackParts,
  cohort: ProposedCohort,
  layerBudget: number,
): TestPlacementRepair => {
  const unchanged = { cohort, layerBudget };
  const layers = onlyLayersOf(cohort);

  if (!layers || layers.size === 0) {
    return unchanged;
  }

  const part = partOf(
    cohort.layers.flatMap((layer) => layer.hunks.map((entry) => entry.hunk)),
  );
  const before = cohortProblems(part.diff, part.facts, cohort);

  if (
    !before.some((each) => each.code === 'tests') ||
    before.some((each) => !REPAIRS_ALONGSIDE.has(each.code))
  ) {
    return unchanged;
  }

  const definesOf = definitionsOf(part.facts);
  const moved = misplacedTests(
    part.facts.links,
    layers,
  ).reduce<ProposedCohort | null>((current, { test, anchor }) => {
    const target = current ? onlyLayersOf(current)?.get(anchor) : undefined;

    return current && target !== undefined
      ? withHunksMovedInto(part.diff, current, [test], target, definesOf)
      : null;
  }, cohort);

  if (
    !moved ||
    cohort.layers.length - moved.layers.length > layerBudget ||
    !keepsEveryQuestion(cohort, moved)
  ) {
    return unchanged;
  }

  const after = cohortProblems(part.diff, part.facts, moved);

  return after.every((each) => each.code === 'moves')
    ? {
        cohort: moved,
        layerBudget: layerBudget - (cohort.layers.length - moved.layers.length),
      }
    : unchanged;
};
