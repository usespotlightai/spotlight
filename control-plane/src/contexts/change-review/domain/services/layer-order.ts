import type { HunkLink } from '@change-review/domain/services/diff-facts';
import { onlyLayersOf } from '@change-review/domain/services/hunk-placements';
import { nearestLevels } from '@change-review/domain/services/nearest-levels';
import {
  keepsEveryQuestion,
  shownHunks,
} from '@change-review/domain/services/shown-questions';
import { cohortProblems } from '@change-review/domain/services/stack-checks';
import type { StackParts } from '@change-review/domain/services/stack-part';
import {
  changedLinesOf,
  type Diff,
} from '@change-review/domain/value-objects/diff.vo';
import {
  LAYER_LINES,
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

const PLACED = new Set<string>([...ORDERED, ...REPAIRED_LATER]);

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

type Direction = 'forward' | 'back' | 'nearest';

const linesOf = (diff: Diff): Map<string, number> =>
  new Map(
    diff.hunks.map((hunk) => {
      const { added, removed } = changedLinesOf(hunk);
      return [hunk.id, added.length + removed.length];
    }),
  );

const biggestLayerOf = (diff: Diff, cohort: ProposedCohort): number => {
  const lines = linesOf(diff);

  return Math.max(
    0,
    ...cohort.layers.map((layer) =>
      layer.hunks.reduce(
        (total, entry) => total + (lines.get(entry.hunk) ?? 0),
        0,
      ),
    ),
  );
};

const levelsOf = (
  links: readonly HunkLink[],
  layers: ReadonlyMap<string, number>,
  direction: Exclude<Direction, 'nearest'>,
): Map<string, number> => {
  const level = new Map(layers);
  const ordered = orderedLinks(links);
  const moves = links.filter((link) => link.kind === 'moves');
  const covered = new Map<string, string[]>();

  for (const link of links.filter((each) => each.kind === 'tests')) {
    if (layers.has(link.from) && layers.has(link.to)) {
      covered.set(link.from, [...(covered.get(link.from) ?? []), link.to]);
    }
  }

  if (direction === 'forward') {
    for (const [test, code] of covered) {
      level.set(test, Math.max(...code.map((each) => level.get(each) ?? 0)));
    }
  }

  let changed = false;
  const moved = (hunk: string, to: number) => {
    const at = level.get(hunk);

    if (at !== undefined && (direction === 'forward' ? at < to : at > to)) {
      level.set(hunk, to);
      changed = true;
    }
  };
  const ahead = (user: string, used: string) => {
    const later = level.get(user);
    const earlier = level.get(used);

    if (later !== undefined && earlier !== undefined && later < earlier) {
      if (direction === 'forward') {
        moved(user, earlier);
      } else {
        moved(used, later);
      }
    }
  };

  do {
    changed = false;

    for (const link of ordered) {
      ahead(link.from, link.to);
    }
    for (const link of moves) {
      ahead(link.from, link.to);
      ahead(link.to, link.from);
    }
    for (const [test, code] of covered) {
      const at = level.get(test) ?? 0;
      const latest = Math.max(...code.map((each) => level.get(each) ?? 0));
      const last = code.find((each) => level.get(each) === latest);

      const [behind, ahead] = at < latest ? [test, last] : [last, test];

      if (at !== latest && behind !== undefined && ahead !== undefined) {
        if (direction === 'forward') {
          moved(behind, Math.max(at, latest));
        } else {
          moved(ahead, Math.min(at, latest));
        }
      }
    }
  } while (changed);

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
  const placeOf = new Map<number, number>();

  for (const [at, { from }] of rebuilt.entries()) {
    if (!placeOf.has(from)) {
      placeOf.set(from, at);
    }
  }

  for (const [from, layer] of cohort.layers.entries()) {
    const start = placeOf.get(from) ?? receiving.get(from) ?? 0;

    for (const question of layer.questions) {
      const destination = layers.findIndex(
        (each, at) =>
          at >= start &&
          each.questions.length < MAX_QUESTIONS &&
          question.hunks.every((hunk) => shownHunks(layers, at).has(hunk)),
      );

      const shown = layers.findIndex(
        (_, at) =>
          at >= start &&
          question.hunks.every((hunk) => shownHunks(layers, at).has(hunk)),
      );

      if (destination < 0 && shown < 0) {
        return null;
      }
      layers[destination < 0 ? shown : destination]?.questions.push(question);
    }
  }

  return layers;
};

const sourceOf = (
  lines: ReadonlyMap<string, number>,
  layers: ReadonlyMap<string, number>,
  hunks: ProposedLayer['hunks'],
): number => {
  const weight = new Map<number, number>();

  for (const entry of hunks) {
    const from = layers.get(entry.hunk) ?? 0;
    weight.set(
      from,
      (weight.get(from) ?? 0) + Math.max(1, lines.get(entry.hunk) ?? 0),
    );
  }

  return [...weight].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
};

const withHunksRelevelled = (
  diff: Diff,
  links: readonly HunkLink[],
  cohort: ProposedCohort,
  layers: ReadonlyMap<string, number>,
  direction: Direction,
): ProposedCohort | null => {
  const lines = linesOf(diff);
  const levels =
    direction === 'nearest'
      ? nearestLevels(links, layers, (hunk) => lines.get(hunk) ?? 0)
      : levelsOf(links, layers, direction);
  const count = Math.max(-1, ...levels.values()) + 1;
  const kept = Array.from({ length: count }, (_, level) =>
    cohort.layers.flatMap((layer) =>
      layer.hunks.filter((entry) => levels.get(entry.hunk) === level),
    ),
  )
    .filter((hunks) => hunks.length > 0)
    .map((hunks) => ({ from: sourceOf(lines, layers, hunks), hunks }));
  const placeOf = new Map<number, number>();

  for (const [at, { from }] of kept.entries()) {
    if (!placeOf.has(from + 1)) {
      placeOf.set(from + 1, at + 1);
    }
  }

  const receiving = new Map(
    cohort.layers.flatMap((layer, from) => {
      const first = layer.hunks[0];
      const at = first
        ? kept.findIndex(({ hunks }) =>
            hunks.some((entry) => entry.hunk === first.hunk),
          )
        : -1;

      return !placeOf.has(from + 1) && at >= 0 ? [[from, at] as const] : [];
    }),
  );
  const summariesOf = (at: number) =>
    [...receiving]
      .filter(([, to]) => to === at)
      .flatMap(([from]) => cohort.layers[from]?.summary ?? []);

  const rebuilt = kept.flatMap(({ from, hunks }, at) => {
    const layer = cohort.layers[from];

    return layer
      ? [
          {
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
                return to !== undefined && to < at + 1
                  ? [{ ...each, layer: to }]
                  : [];
              }),
            },
          },
        ]
      : [];
  });
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
    before.every((each) => each.code === 'moves') ||
    before.some((each) => !PLACED.has(each.code))
  ) {
    return unchanged;
  }

  const sorted = withLayersSorted(part.facts.links, cohort, layers);
  const relevelled = (from: ProposedCohort | null, direction: Direction) => {
    const placed = from && onlyLayersOf(from);
    return from && placed
      ? withHunksRelevelled(
          part.diff,
          part.facts.links,
          from,
          placed,
          direction,
        )
      : null;
  };
  const candidates = [
    sorted,
    relevelled(cohort, 'nearest'),
    relevelled(sorted, 'nearest'),
    relevelled(sorted, 'back'),
    relevelled(sorted, 'forward'),
    relevelled(cohort, 'back'),
    relevelled(cohort, 'forward'),
  ].filter(
    (each): each is ProposedCohort =>
      each !== null && cohort.layers.length - each.layers.length <= layerBudget,
  );
  const keeping = candidates.filter((each) => keepsEveryQuestion(cohort, each));
  const fixed = (each: ProposedCohort) => problemsOf(each).length === 0;
  const enough = Math.max(LAYER_LINES, biggestLayerOf(part.diff, cohort));
  const sizeOf = (each: ProposedCohort) =>
    Math.max(enough, biggestLayerOf(part.diff, each));
  const smallest = (each: readonly ProposedCohort[]) =>
    [...each].sort((a, b) => sizeOf(a) - sizeOf(b))[0];
  const current =
    smallest(keeping.filter(fixed)) ??
    smallest(candidates.filter(fixed)) ??
    (before.some((each) => ORDERED.has(each.code))
      ? keeping.find((each) =>
          problemsOf(each).every((problem) => REPAIRED_LATER.has(problem.code)),
        )
      : undefined);

  return current
    ? {
        cohort: current,
        layerBudget:
          layerBudget - (cohort.layers.length - current.layers.length),
      }
    : unchanged;
};
