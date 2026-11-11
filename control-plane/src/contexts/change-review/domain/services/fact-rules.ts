import type { StackProblem } from '@change-review/domain/exceptions/invalid-change-stack.error';
import {
  connectedGroups,
  type DiffFacts,
  type HunkLink,
  linkFact,
} from '@change-review/domain/services/diff-facts';
import { groupedBy } from '@change-review/domain/services/grouped-by';
import { placementsOf } from '@change-review/domain/services/hunk-placements';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';

interface Assignment {
  readonly cohort: number;
  readonly layer: number;
}

const assignmentsOf = (
  cohorts: readonly ProposedCohort[],
): Map<string, Assignment> =>
  new Map(
    [...placementsOf(cohorts)].flatMap(([hunk, placements]) => {
      const last = placements[placements.length - 1];
      return last ? [[hunk, { cohort: last.cohort, layer: last.layer }]] : [];
    }),
  );

const layerName = (assignment: Assignment): string =>
  `layer ${assignment.layer + 1}`;

const orderProblems = (
  code: 'uses' | 'removes',
  links: readonly HunkLink[],
  assignments: ReadonlyMap<string, Assignment>,
): StackProblem[] =>
  links.flatMap((link): StackProblem[] => {
    const later = assignments.get(link.from);
    const earlier = assignments.get(link.to);
    const fact = `${link.from} ${linkFact(link)}`;

    if (!later || !earlier) {
      return [];
    }
    if (later.cohort !== earlier.cohort) {
      return [{ code, message: `${fact}, so they belong in the same cohort` }];
    }
    if (later.layer < earlier.layer) {
      return [
        {
          code,
          message: `${fact}, so it cannot come in an earlier layer than ${link.to}`,
        },
      ];
    }

    return [];
  });

const testsProblems = (
  links: readonly HunkLink[],
  assignments: ReadonlyMap<string, Assignment>,
): StackProblem[] => {
  const byTest = groupedBy(links, (link) => link.from);

  return [...byTest.entries()].flatMap(([test, covered]): StackProblem[] => {
    const assigned = assignments.get(test);

    if (!assigned) {
      return [];
    }

    const sources = covered.flatMap((link) => {
      const source = assignments.get(link.to);
      return source ? [{ link, source }] : [];
    });
    const apart = sources.filter(
      ({ source }) => source.cohort !== assigned.cohort,
    );

    if (apart.length > 0) {
      return apart.map(({ link }) => ({
        code: 'tests',
        message: `${test} tests ${link.because.join(', ')} in ${link.to}, so they belong in the same cohort`,
      }));
    }

    const latest = Math.max(...sources.map(({ source }) => source.layer));

    return sources.length > 0 && assigned.layer !== latest
      ? [
          {
            code: 'tests',
            message: `${test} tests ${[...new Set(sources.flatMap(({ link }) => link.because))].join(', ')}, so it belongs in layer ${latest + 1} with the code it covers`,
          },
        ]
      : [];
  });
};

const movesProblems = (
  links: readonly HunkLink[],
  assignments: ReadonlyMap<string, Assignment>,
): StackProblem[] =>
  links.flatMap(({ from, to }): StackProblem[] => {
    const added = assignments.get(from);
    const removed = assignments.get(to);

    return added &&
      removed &&
      (added.cohort !== removed.cohort || added.layer !== removed.layer)
      ? [
          {
            code: 'moves',
            message: `${from} is code moved from ${to}, so they belong in the same layer`,
          },
        ]
      : [];
  });

const migrationProblems = (
  cohorts: readonly ProposedCohort[],
  facts: DiffFacts,
  assignments: ReadonlyMap<string, Assignment>,
): StackProblem[] =>
  facts.hunks
    .filter((each) => each.fileClass === 'migration')
    .flatMap((each): StackProblem[] => {
      const assigned = assignments.get(each.hunk);

      return assigned &&
        cohorts[assigned.cohort]?.kind === 'change' &&
        assigned.layer > 0
        ? [
            {
              code: 'migration',
              message: `${each.hunk} is a migration, so it belongs in layer 1 of its cohort, not ${layerName(assigned)}`,
            },
          ]
        : [];
    });

const unconnectedProblems = (
  cohorts: readonly ProposedCohort[],
  facts: DiffFacts,
): StackProblem[] => {
  const linkable = new Set(
    facts.hunks.filter((each) => each.linkable).map((each) => each.hunk),
  );

  return cohorts.flatMap((cohort, c): StackProblem[] => {
    if (cohort.kind !== 'change' || cohort.joinedBecause?.trim()) {
      return [];
    }

    const hunks = cohort.layers
      .flatMap((layer) => layer.hunks.map((entry) => entry.hunk))
      .filter((hunk) => linkable.has(hunk));

    if (hunks.length < 2) {
      return [];
    }

    const groups = connectedGroups(hunks, facts.links);

    return groups.length > 1
      ? [
          {
            code: 'unconnected',
            message: `cohort ${c + 1} joins hunks the code does not connect (${groups.map((each) => each.join(', ')).join(' | ')}) without saying why`,
          },
        ]
      : [];
  });
};

export const factProblems = (
  cohorts: readonly ProposedCohort[],
  facts: DiffFacts,
): StackProblem[] => {
  const assignments = assignmentsOf(cohorts);
  const of = (kind: HunkLink['kind']) =>
    facts.links.filter((link) => link.kind === kind);

  return [
    ...orderProblems('uses', of('uses'), assignments),
    ...orderProblems('removes', of('removes'), assignments),
    ...testsProblems(of('tests'), assignments),
    ...movesProblems(of('moves'), assignments),
    ...migrationProblems(cohorts, facts, assignments),
    ...unconnectedProblems(cohorts, facts),
  ];
};

export const derivedDependencies = (
  cohorts: readonly ProposedCohort[],
  links: readonly HunkLink[],
): Map<string, Map<number, Set<string>>> => {
  const assignments = assignmentsOf(cohorts);
  const derived = new Map<string, Map<number, Set<string>>>();

  for (const { kind, from, to, because } of links) {
    const later = assignments.get(from);
    const earlier = assignments.get(to);

    if (
      kind === 'moves' ||
      !later ||
      !earlier ||
      later.cohort !== earlier.cohort ||
      earlier.layer >= later.layer
    ) {
      continue;
    }

    const key = `${later.cohort}.${later.layer}`;
    const layers = derived.get(key) ?? new Map<number, Set<string>>();
    const symbols = layers.get(earlier.layer + 1) ?? new Set<string>();

    for (const symbol of because) {
      symbols.add(symbol);
    }
    layers.set(earlier.layer + 1, symbols);
    derived.set(key, layers);
  }

  return derived;
};
