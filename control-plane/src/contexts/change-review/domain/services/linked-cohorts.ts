import {
  connectedGroups,
  type DiffFacts,
} from '@change-review/domain/services/diff-facts';
import {
  changedLinesOf,
  type Diff,
} from '@change-review/domain/value-objects/diff.vo';
import type { OutlinedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

const placedOnce = (
  cohorts: readonly OutlinedCohort[],
): Map<HunkId, number> | null => {
  const placed = new Map<HunkId, number>();

  for (const [at, cohort] of cohorts.entries()) {
    for (const hunk of cohort.hunks) {
      if (placed.has(hunk)) {
        return null;
      }
      placed.set(hunk, at);
    }
  }
  return placed;
};

const linesOf = (diff: Diff): Map<HunkId, number> =>
  new Map(
    diff.hunks.map((hunk) => {
      const { added, removed } = changedLinesOf(hunk);
      return [hunk.id, added.length + removed.length];
    }),
  );

const homeOf = (
  group: readonly HunkId[],
  placed: ReadonlyMap<HunkId, number>,
  lines: ReadonlyMap<HunkId, number>,
): number => {
  const weight = new Map<number, number>();

  for (const hunk of group) {
    const at = placed.get(hunk);

    if (at !== undefined) {
      weight.set(at, (weight.get(at) ?? 0) + Math.max(lines.get(hunk) ?? 0, 1));
    }
  }

  return [...weight].sort(([a, x], [b, y]) => y - x || a - b)[0]?.[0] ?? -1;
};

export const withLinkedHunksInOneCohort = (
  diff: Diff,
  facts: DiffFacts,
  cohorts: readonly OutlinedCohort[],
): readonly OutlinedCohort[] => {
  const placed = placedOnce(cohorts);

  if (!placed) {
    return cohorts;
  }

  const lines = linesOf(diff);
  const home = new Map<HunkId, number>();

  for (const group of connectedGroups([...placed.keys()], facts.links)) {
    const at = homeOf(group, placed, lines);

    for (const hunk of group) {
      home.set(hunk, at);
    }
  }

  if ([...placed].every(([hunk, at]) => home.get(hunk) === at)) {
    return cohorts;
  }

  return cohorts.flatMap((cohort, at) => {
    const hunks = [...placed.keys()].filter((hunk) => home.get(hunk) === at);
    return hunks.length > 0 ? [{ ...cohort, hunks }] : [];
  });
};
