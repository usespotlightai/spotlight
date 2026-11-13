import type { HunkLink } from '@change-review/domain/services/diff-facts';
import { onlyLayersOf } from '@change-review/domain/services/hunk-placements';
import {
  keepsEveryQuestion,
  shownHunks,
} from '@change-review/domain/services/shown-questions';
import { cohortProblems } from '@change-review/domain/services/stack-checks';
import type { StackParts } from '@change-review/domain/services/stack-part';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import {
  MAX_QUESTIONS,
  type ProposedCohort,
  type ProposedLayer,
  type ProposedQuestion,
} from '@change-review/domain/value-objects/stack-cohort.vo';

export interface LayerOrderRepair {
  readonly cohort: ProposedCohort;
  readonly layerBudget: number;
}

const ORDERED = new Set<string>(['uses', 'removes']);

const REPAIRED_LATER = new Set<string>(['tests', 'moves']);

const orderedLinks = (links: readonly HunkLink[]): HunkLink[] =>
  links.filter((link) => ORDERED.has(link.kind));

const layerEdges = (
  links: readonly HunkLink[],
  cohort: ProposedCohort,
  layers: ReadonlyMap<string, number>,
): Set<number>[] => {
  const before = cohort.layers.map(() => new Set<number>());

  for (const link of orderedLinks(links)) {
    const later = layers.get(link.from);
    const earlier = layers.get(link.to);

    if (later !== undefined && earlier !== undefined && later !== earlier) {
      before[later]?.add(earlier);
    }
  }
  for (const [at, layer] of cohort.layers.entries()) {
    for (const dependency of layer.dependsOn) {
      if (dependency.layer - 1 !== at) {
        before[at]?.add(dependency.layer - 1);
      }
    }
  }

  return before;
};

const sortedOrder = (before: readonly Set<number>[]): number[] | null => {
  const order: number[] = [];
  const placed = new Set<number>();

  while (order.length < before.length) {
    const next = before.findIndex(
      (needs, at) =>
        !placed.has(at) && [...needs].every((each) => placed.has(each)),
    );

    if (next < 0) {
      return null;
    }
    order.push(next);
    placed.add(next);
  }

  return order;
};

const withLayersSorted = (
  links: readonly HunkLink[],
  cohort: ProposedCohort,
  layers: ReadonlyMap<string, number>,
): ProposedCohort | null => {
  const order = sortedOrder(layerEdges(links, cohort, layers));

  if (!order || order.every((from, at) => from === at)) {
    return null;
  }

  const placeOf = new Map(order.map((from, at) => [from + 1, at + 1]));

  return {
    ...cohort,
    layers: order.flatMap((from) => {
      const layer = cohort.layers[from];

      return layer
        ? [
            {
              ...layer,
              dependsOn: layer.dependsOn.map((each) => ({
                ...each,
                layer: placeOf.get(each.layer) ?? each.layer,
              })),
            },
          ]
        : [];
    }),
  };
};

const pushedLevels = (
  links: readonly HunkLink[],
  layers: ReadonlyMap<string, number>,
): Map<string, number> => {
  const level = new Map(layers);
  const ordered = orderedLinks(links);

  for (let changed = true; changed;) {
    changed = false;

    for (const link of ordered) {
      const user = level.get(link.from);
      const used = level.get(link.to);

      if (user !== undefined && used !== undefined && user < used) {
        level.set(link.from, used);
        changed = true;
      }
    }
  }

  return level;
};

const notesFor = (
  diff: Diff,
  cohort: ProposedCohort,
  from: number,
  hunks: ProposedLayer['hunks'],
  layers: ReadonlyMap<string, number>,
): ProposedLayer['notes'] => {
  const paths = diff.pathsOf(hunks.map((entry) => entry.hunk));
  const sources = [
    from,
    ...hunks.map((entry) => layers.get(entry.hunk) ?? from),
  ];

  return [...paths].flatMap((path) => {
    const note = sources
      .flatMap((source) => cohort.layers[source]?.notes ?? [])
      .find((each) => each.path === path);
    return note ? [note] : [];
  });
};

const withQuestionsPlaced = (
  cohort: ProposedCohort,
  rebuilt: readonly { from: number; layer: ProposedLayer }[],
  receiving: ReadonlyMap<number, number>,
): ProposedLayer[] | null => {
  const layers = rebuilt.map(({ layer }) => ({
    ...layer,
    questions: [] as ProposedQuestion[],
  }));
  const placeOf = new Map(rebuilt.map(({ from }, at) => [from, at]));

  for (const [from, layer] of cohort.layers.entries()) {
    const start = placeOf.get(from) ?? receiving.get(from) ?? 0;

    for (const question of layer.questions) {
      const destination = layers.findIndex(
        (each, at) =>
          at >= start &&
          each.questions.length < MAX_QUESTIONS &&
          question.hunks.every((hunk) => shownHunks(layers, at).has(hunk)),
      );

      if (destination < 0) {
        return null;
      }
      layers[destination]?.questions.push(question);
    }
  }

  return layers;
};

const withUsersPushedForward = (
  diff: Diff,
  links: readonly HunkLink[],
  cohort: ProposedCohort,
  layers: ReadonlyMap<string, number>,
): ProposedCohort | null => {
  const levels = pushedLevels(links, layers);
  const arriving = (at: number) =>
    cohort.layers.flatMap((layer, from) =>
      from === at
        ? []
        : layer.hunks.filter((entry) => levels.get(entry.hunk) === at),
    );
  const kept = cohort.layers.flatMap((layer, from) => {
    const hunks = [
      ...layer.hunks.filter((entry) => levels.get(entry.hunk) === from),
      ...arriving(from),
    ];
    return hunks.length > 0 ? [{ from, layer, hunks }] : [];
  });
  const placeOf = new Map(kept.map(({ from }, at) => [from + 1, at + 1]));
  const receiving = new Map(
    cohort.layers.flatMap((layer, from) => {
      const first = layer.hunks[0];
      const to = first ? levels.get(first.hunk) : undefined;
      const at = to === undefined ? undefined : placeOf.get(to + 1);

      return !placeOf.has(from + 1) && at !== undefined
        ? [[from, at - 1] as const]
        : [];
    }),
  );
  const summariesOf = (at: number) =>
    [...receiving]
      .filter(([, to]) => to === at)
      .flatMap(([from]) => cohort.layers[from]?.summary ?? []);

  const rebuilt = kept.map(({ from, layer, hunks }, at) => ({
    from,
    layer: {
      ...layer,
      hunks,
      summary: [
        ...new Set([layer.summary, ...summariesOf(at)].filter(Boolean)),
      ].join(' '),
      notes: notesFor(diff, cohort, from, hunks, layers),
      dependsOn: layer.dependsOn.flatMap((each) => {
        const to = placeOf.get(each.layer);
        return to !== undefined && to < at + 1 ? [{ ...each, layer: to }] : [];
      }),
    },
  }));
  const placed = withQuestionsPlaced(cohort, rebuilt, receiving);

  return placed ? { ...cohort, layers: placed } : null;
};

export const withLayersInOrder = (
  partOf: StackParts,
  cohort: ProposedCohort,
  layerBudget: number,
): LayerOrderRepair => {
  const unchanged = { cohort, layerBudget };
  const layers = onlyLayersOf(cohort);

  if (!layers || layers.size === 0) {
    return unchanged;
  }

  const part = partOf(
    cohort.layers.flatMap((layer) => layer.hunks.map((entry) => entry.hunk)),
  );
  const problemsOf = (each: ProposedCohort) =>
    cohortProblems(part.diff, part.facts, each);
  const before = problemsOf(cohort);

  if (
    !before.some((each) => ORDERED.has(each.code)) ||
    before.some(
      (each) => !ORDERED.has(each.code) && !REPAIRED_LATER.has(each.code),
    )
  ) {
    return unchanged;
  }

  const sorted = withLayersSorted(part.facts.links, cohort, layers);
  const current =
    sorted && !problemsOf(sorted).some((each) => ORDERED.has(each.code))
      ? sorted
      : withUsersPushedForward(part.diff, part.facts.links, cohort, layers);

  if (
    !current ||
    cohort.layers.length - current.layers.length > layerBudget ||
    !keepsEveryQuestion(cohort, current)
  ) {
    return unchanged;
  }

  return problemsOf(current).every((each) => REPAIRED_LATER.has(each.code))
    ? {
        cohort: current,
        layerBudget:
          layerBudget - (cohort.layers.length - current.layers.length),
      }
    : unchanged;
};
