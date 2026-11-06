import { withHunksMovedInto } from '@change-review/domain/services/cohort-hunks';
import {
  connectedGroups,
  type DiffFacts,
} from '@change-review/domain/services/diff-facts';
import { factProblems } from '@change-review/domain/services/fact-rules';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

const movedGroups = (facts: DiffFacts): HunkId[][] => {
  const moves = facts.links.filter((link) => link.kind === 'moves');

  return connectedGroups(
    [...new Set(moves.flatMap(({ from, to }) => [from, to]))],
    moves,
  );
};

const layerIndexOf = (cohort: ProposedCohort, hunk: HunkId): number =>
  cohort.layers.findIndex((layer) =>
    layer.hunks.some((entry) => entry.hunk === hunk),
  );

const togetherIn = (
  diff: Diff,
  facts: DiffFacts,
  cohort: ProposedCohort,
  group: readonly HunkId[],
): ProposedCohort => {
  const at = [...new Set(group.map((hunk) => layerIndexOf(cohort, hunk)))];

  if (at.includes(-1) || at.length < 2) {
    return cohort;
  }

  const candidates = at
    .sort((a, b) => b - a)
    .map((target) => withHunksMovedInto(diff, cohort, group, target));
  const broken = candidates.map(
    (candidate) => factProblems([candidate], facts).length,
  );

  return candidates[broken.indexOf(Math.min(...broken))] ?? cohort;
};

export const withMovedCodeTogether = (
  diff: Diff,
  facts: DiffFacts,
  cohort: ProposedCohort,
): ProposedCohort =>
  movedGroups(facts).reduce(
    (arranged, group) => togetherIn(diff, facts, arranged, group),
    cohort,
  );
