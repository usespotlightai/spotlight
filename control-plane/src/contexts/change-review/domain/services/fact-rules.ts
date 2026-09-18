import type { StackProblem } from '@change-review/domain/exceptions/invalid-change-stack.error';
import type {
  DiffFacts,
  HunkLink,
} from '@change-review/domain/services/diff-facts';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

interface Placement {
  readonly cohort: number;
  readonly layer: number;
}

const placementsOf = (
  cohorts: readonly ProposedCohort[],
): Map<string, Placement> => {
  const placements = new Map<string, Placement>();

  cohorts.forEach((cohort, c) => {
    cohort.layers.forEach((layer, l) => {
      for (const range of layer.ranges) {
        placements.set(range.hunk, { cohort: c, layer: l });
      }
    });
  });

  return placements;
};

const layerName = (placement: Placement): string =>
  `layer ${placement.layer + 1}`;

const usesProblems = (
  links: readonly HunkLink[],
  placements: ReadonlyMap<string, Placement>,
): StackProblem[] =>
  links.flatMap(({ from, to, because }): StackProblem[] => {
    const user = placements.get(from);
    const definer = placements.get(to);
    const uses = `${from} uses ${because.join(', ')} from ${to}`;

    if (!user || !definer) {
      return [];
    }
    if (user.cohort !== definer.cohort) {
      return [
        { code: 'uses', message: `${uses}, so they belong in the same cohort` },
      ];
    }
    if (user.layer < definer.layer) {
      return [
        {
          code: 'uses',
          message: `${uses}, so it cannot come in an earlier layer than ${to}`,
        },
      ];
    }

    return [];
  });

const testsProblems = (
  links: readonly HunkLink[],
  placements: ReadonlyMap<string, Placement>,
): StackProblem[] => {
  const byTest = new Map<string, HunkLink[]>();

  for (const link of links) {
    byTest.set(link.from, [...(byTest.get(link.from) ?? []), link]);
  }

  return [...byTest.entries()].flatMap(([test, covered]): StackProblem[] => {
    const placed = placements.get(test);

    if (!placed) {
      return [];
    }

    const sources = covered.flatMap((link) => {
      const source = placements.get(link.to);
      return source ? [{ link, source }] : [];
    });
    const apart = sources.filter(
      ({ source }) => source.cohort !== placed.cohort,
    );

    if (apart.length > 0) {
      return apart.map(({ link }) => ({
        code: 'tests',
        message: `${test} tests ${link.because.join(', ')} in ${link.to}, so they belong in the same cohort`,
      }));
    }

    const latest = Math.max(...sources.map(({ source }) => source.layer));

    return sources.length > 0 && placed.layer !== latest
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
  placements: ReadonlyMap<string, Placement>,
): StackProblem[] =>
  links.flatMap(({ from, to }): StackProblem[] => {
    const added = placements.get(from);
    const removed = placements.get(to);

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
  placements: ReadonlyMap<string, Placement>,
): StackProblem[] =>
  facts.hunks
    .filter((each) => each.fileClass === 'migration')
    .flatMap((each): StackProblem[] => {
      const placed = placements.get(each.hunk);

      return placed &&
        cohorts[placed.cohort]?.kind === 'change' &&
        placed.layer > 0
        ? [
            {
              code: 'migration',
              message: `${each.hunk} is a migration, so it belongs in layer 1 of its cohort, not ${layerName(placed)}`,
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
      .flatMap((layer) => layer.ranges.map((range) => range.hunk))
      .filter((hunk) => linkable.has(hunk));

    if (hunks.length < 2) {
      return [];
    }

    const group = new Map<HunkId, HunkId>(hunks.map((hunk) => [hunk, hunk]));
    const root = (hunk: HunkId): HunkId => {
      const parent = group.get(hunk) ?? hunk;
      return parent === hunk ? hunk : root(parent);
    };

    for (const { from, to } of facts.links) {
      if (group.has(from) && group.has(to)) {
        group.set(root(from), root(to));
      }
    }

    const groups = new Map<string, string[]>();

    for (const hunk of hunks) {
      groups.set(root(hunk), [...(groups.get(root(hunk)) ?? []), hunk]);
    }

    return groups.size > 1
      ? [
          {
            code: 'unconnected',
            message: `cohort ${c + 1} joins changes the code does not connect (${[...groups.values()].map((each) => each.join(', ')).join(' | ')}) without saying why`,
          },
        ]
      : [];
  });
};

export const factProblems = (
  cohorts: readonly ProposedCohort[],
  facts: DiffFacts,
): StackProblem[] => {
  const placements = placementsOf(cohorts);
  const of = (kind: HunkLink['kind']) =>
    facts.links.filter((link) => link.kind === kind);

  return [
    ...usesProblems(of('uses'), placements),
    ...testsProblems(of('tests'), placements),
    ...movesProblems(of('moves'), placements),
    ...migrationProblems(cohorts, facts, placements),
    ...unconnectedProblems(cohorts, facts),
  ];
};

export const derivedDependencies = (
  cohorts: readonly ProposedCohort[],
  links: readonly HunkLink[],
): Map<string, Map<number, Set<string>>> => {
  const placements = placementsOf(cohorts);
  const derived = new Map<string, Map<number, Set<string>>>();

  for (const { kind, from, to, because } of links) {
    const user = placements.get(from);
    const definer = placements.get(to);

    if (
      kind === 'moves' ||
      !user ||
      !definer ||
      user.cohort !== definer.cohort ||
      definer.layer >= user.layer
    ) {
      continue;
    }

    const key = `${user.cohort}.${user.layer}`;
    const layers = derived.get(key) ?? new Map<number, Set<string>>();
    const symbols = layers.get(definer.layer + 1) ?? new Set<string>();

    for (const symbol of because) {
      symbols.add(symbol);
    }
    layers.set(definer.layer + 1, symbols);
    derived.set(key, layers);
  }

  return derived;
};
