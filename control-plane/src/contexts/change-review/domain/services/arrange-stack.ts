import type {
  DiffFacts,
  FileClass,
} from '@change-review/domain/services/diff-facts';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type {
  ProposedCohort,
  ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';

const INCIDENTAL_CLASSES: Partial<Record<FileClass, string>> = {
  lockfile: 'lockfiles',
  generated: 'generated files',
  snapshot: 'test snapshots',
};

const listed = (words: readonly string[]): string =>
  words.length <= 1
    ? (words[0] ?? '')
    : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;

const pathsOf = (diff: Diff, ranges: ProposedLayer['ranges']): Set<string> =>
  new Set(ranges.flatMap((range) => diff.fileOf(range.hunk)?.path ?? []));

const withoutHunks = (
  diff: Diff,
  cohort: ProposedCohort,
  leaving: ReadonlySet<string>,
): ProposedCohort | null => {
  const kept: { layer: ProposedLayer; from: number }[] = [];

  cohort.layers.forEach((layer, place) => {
    const ranges = layer.ranges.filter((range) => !leaving.has(range.hunk));

    if (ranges.length > 0) {
      const before = pathsOf(diff, layer.ranges);
      const still = pathsOf(diff, ranges);
      const notes = layer.notes.filter(
        (each) => still.has(each.path) || !before.has(each.path),
      );

      kept.push({ layer: { ...layer, ranges, notes }, from: place + 1 });
    }
  });

  if (kept.length === 0) {
    return null;
  }

  const renumbered = new Map(kept.map(({ from }, place) => [from, place + 1]));

  return {
    ...cohort,
    layers: kept.map(({ layer }) => ({
      ...layer,
      dependsOn: layer.dependsOn.flatMap((dependency) => {
        const layerNow = renumbered.get(dependency.layer);
        return layerNow ? [{ ...dependency, layer: layerNow }] : [];
      }),
    })),
  };
};

export const arranged = (
  diff: Diff,
  facts: DiffFacts,
  proposed: readonly ProposedCohort[],
): ProposedCohort[] => {
  const incidental = facts.hunks.filter((each) => each.incidental);
  const leaving = new Set(incidental.map((each) => each.hunk));

  const cohorts = proposed.flatMap((cohort) => {
    if (cohort.layers.length === 0) {
      return [cohort];
    }

    const kept = withoutHunks(diff, cohort, leaving);
    return kept ? [kept] : [];
  });

  if (incidental.length === 0) {
    return cohorts;
  }

  const kinds = [
    ...new Set(
      incidental.map((each) =>
        each.renamed
          ? 'renamed files'
          : (INCIDENTAL_CLASSES[each.fileClass] ?? 'formatting'),
      ),
    ),
  ];
  const order = new Map(diff.hunks.map((hunk, place) => [hunk.id, place]));
  const title = `Update ${listed(kinds)}`;

  return [
    ...cohorts,
    {
      kind: 'incidental',
      title,
      intent: `Incidental changes to ${listed(kinds)}. They need no review on their own.`,
      layers: [
        {
          title,
          summary: `Spotlight recognised ${incidental.length} ${incidental.length === 1 ? 'change' : 'changes'} as incidental.`,
          dependsOn: [],
          ranges: [...incidental]
            .sort((a, b) => (order.get(a.hunk) ?? 0) - (order.get(b.hunk) ?? 0))
            .map((each) => ({ hunk: each.hunk })),
          notes: [],
        },
      ],
    },
  ];
};
