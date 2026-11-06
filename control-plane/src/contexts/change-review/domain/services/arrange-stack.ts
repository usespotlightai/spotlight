import { withoutHunks } from '@change-review/domain/services/cohort-hunks';
import type {
  DiffFacts,
  FileClass,
} from '@change-review/domain/services/diff-facts';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';

const INCIDENTAL_CLASSES: Partial<Record<FileClass, string>> = {
  lockfile: 'lockfiles',
  generated: 'generated files',
  snapshot: 'test snapshots',
};

const listed = (words: readonly string[]): string =>
  words.length <= 1
    ? (words[0] ?? '')
    : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;

export const arranged = (
  diff: Diff,
  facts: DiffFacts,
  proposed: readonly ProposedCohort[],
): ProposedCohort[] => {
  const incidental = facts.hunks.filter((each) => each.incidental);
  const leaving = incidental.map((each) => each.hunk);

  const cohorts = proposed.flatMap((cohort) => {
    if (cohort.layers.length === 0) {
      return [cohort];
    }

    const remaining = withoutHunks(diff, cohort, leaving);
    return remaining ? [remaining] : [];
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
          summary: `Spotlight recognised ${incidental.length} ${incidental.length === 1 ? 'hunk' : 'hunks'} as incidental.`,
          dependsOn: [],
          hunks: [...incidental]
            .sort((a, b) => (order.get(a.hunk) ?? 0) - (order.get(b.hunk) ?? 0))
            .map((each) => ({ hunk: each.hunk })),
          notes: [],
          questions: [],
        },
      ],
    },
  ];
};
