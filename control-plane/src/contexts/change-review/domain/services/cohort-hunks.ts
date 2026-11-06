import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type {
  ProposedCohort,
  ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

type Dependency = ProposedLayer['dependsOn'][number];

interface Stripped {
  readonly layer: ProposedLayer;
  readonly emptied: boolean;
}

const pathsOf = (diff: Diff, hunks: ProposedLayer['hunks']): Set<string> =>
  new Set(hunks.flatMap((entry) => diff.fileOf(entry.hunk)?.path ?? []));

const stripped = (
  diff: Diff,
  layer: ProposedLayer,
  leaving: ReadonlySet<string>,
): Stripped => {
  const hunks = layer.hunks.filter((entry) => !leaving.has(entry.hunk));
  const before = pathsOf(diff, layer.hunks);
  const still = pathsOf(diff, hunks);

  return {
    layer: {
      ...layer,
      hunks,
      notes: layer.notes.filter(
        (each) => still.has(each.path) || !before.has(each.path),
      ),
    },
    emptied: layer.hunks.length > 0 && hunks.length === 0,
  };
};

const merged = (
  dependencies: readonly { dependency: Dependency; remapped: boolean }[],
  numberOf: (layer: number) => number | undefined,
  place: number,
): Dependency[] => {
  const because = new Map<number, Set<string>>();

  for (const { dependency, remapped } of dependencies) {
    const layer = numberOf(dependency.layer);

    if (layer === undefined || (remapped && layer >= place)) {
      continue;
    }

    because.set(
      layer,
      new Set([...(because.get(layer) ?? []), ...dependency.because]),
    );
  }

  return [...because].map(([layer, symbols]) => ({
    layer,
    because: [...symbols],
  }));
};

const renumbered = (
  cohort: ProposedCohort,
  layers: readonly Stripped[],
  into: number | null,
): ProposedCohort => {
  const kept = layers.flatMap((each, l) =>
    each.emptied ? [] : [{ ...each, from: l + 1 }],
  );
  const places = new Map(kept.map(({ from }, place) => [from, place + 1]));
  const emptied = new Set(
    layers.flatMap((each, l) => (each.emptied ? [l + 1] : [])),
  );
  const numberOf = (layer: number) =>
    emptied.has(layer)
      ? into === null
        ? undefined
        : places.get(into + 1)
      : places.get(layer);
  const carried = layers.flatMap(({ layer, emptied }) =>
    emptied ? layer.dependsOn : [],
  );

  return {
    ...cohort,
    layers: kept.map(({ layer, from }, at) => {
      const own = layer.dependsOn.map((dependency) => ({
        dependency,
        remapped: emptied.has(dependency.layer),
      }));
      const moved =
        into !== null && from === into + 1
          ? carried.map((dependency) => ({ dependency, remapped: true }))
          : [];

      return {
        ...layer,
        dependsOn: merged([...own, ...moved], numberOf, at + 1),
      };
    }),
  };
};

export const withoutHunks = (
  diff: Diff,
  cohort: ProposedCohort,
  hunks: readonly HunkId[],
): ProposedCohort | null => {
  const leaving = new Set<string>(hunks);
  const layers = cohort.layers.map((layer): Stripped => {
    const left = stripped(diff, layer, leaving);

    return {
      ...left,
      layer: {
        ...left.layer,
        questions: layer.questions.flatMap((each) => {
          const cited = each.hunks.filter((hunk) => !leaving.has(hunk));
          return cited.length > 0 ? [{ ...each, hunks: cited }] : [];
        }),
      },
    };
  });

  return layers.some(({ layer }) => layer.hunks.length > 0)
    ? renumbered(cohort, layers, null)
    : null;
};

export const withHunksMovedInto = (
  diff: Diff,
  cohort: ProposedCohort,
  hunks: readonly HunkId[],
  target: number,
): ProposedCohort => {
  const held = cohort.layers[target];

  if (!held) {
    return cohort;
  }

  const moving = new Set<string>(hunks);
  const left = cohort.layers.map((layer, l) =>
    l === target ? { layer, emptied: false } : stripped(diff, layer, moving),
  );
  const relocated = (l: number, cited: readonly HunkId[]) =>
    l !== target &&
    (left[l]?.emptied === true ||
      (l < target && cited.some((hunk) => moving.has(hunk))));

  const notesByPath = new Map(
    cohort.layers.flatMap((layer, l) => {
      const paths = pathsOf(
        diff,
        layer.hunks.filter((entry) => l !== target && moving.has(entry.hunk)),
      );
      return layer.notes
        .filter((each) => paths.has(each.path))
        .map((each) => [each.path, each] as const);
    }),
  );
  const added = hunks.filter(
    (hunk) => !held.hunks.some((entry) => entry.hunk === hunk),
  );
  const notes = [...held.notes];

  for (const hunk of added) {
    const path = diff.fileOf(hunk)?.path;
    const note = path === undefined ? undefined : notesByPath.get(path);

    if (note && !notes.some((each) => each.path === note.path)) {
      notes.push(note);
    }
  }

  const arriving = cohort.layers.flatMap((layer, l) =>
    layer.questions.filter((each) => relocated(l, each.hunks)),
  );

  return renumbered(
    cohort,
    left.map(({ layer, emptied }, l) =>
      l === target
        ? {
            emptied,
            layer: {
              ...held,
              hunks: [...held.hunks, ...added.map((hunk) => ({ hunk }))],
              notes,
              questions: [...held.questions, ...arriving],
            },
          }
        : {
            emptied,
            layer: {
              ...layer,
              questions: layer.questions.filter(
                (each) => !relocated(l, each.hunks),
              ),
            },
          },
    ),
    target,
  );
};
