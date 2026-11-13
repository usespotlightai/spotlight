import { mergedByLayer } from '@change-review/domain/services/layer-dependencies';
import { shownHunks } from '@change-review/domain/services/shown-questions';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import {
  type FileNote,
  MAX_QUESTIONS,
  type ProposedCohort,
  type ProposedLayer,
  type ProposedQuestion,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

type Dependency = ProposedLayer['dependsOn'][number];

interface Remaining {
  readonly layer: ProposedLayer;
  readonly emptied: boolean;
}

const pathsOf = (diff: Diff, hunks: ProposedLayer['hunks']): Set<string> =>
  diff.pathsOf(hunks.map((entry) => entry.hunk));

const layerWithout = (
  diff: Diff,
  layer: ProposedLayer,
  leaving: ReadonlySet<string>,
): Remaining => {
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

const renumberedDependencies = (
  dependencies: readonly {
    dependency: Dependency;
    remapped: boolean;
    unchecked?: boolean;
  }[],
  numberOf: (layer: number, unchecked?: boolean) => number | undefined,
  place: number,
): Dependency[] | null => {
  const kept: Dependency[] = [];

  for (const { dependency, remapped, unchecked } of dependencies) {
    const layer = numberOf(dependency.layer, unchecked);

    if (remapped && layer !== undefined && layer > place) {
      return null;
    }
    if (layer !== undefined && !(remapped && layer === place)) {
      kept.push({ ...dependency, layer });
    }
  }

  return kept;
};

const merged = (dependencies: readonly Dependency[]): Dependency[] =>
  [...mergedByLayer(dependencies)].map(([layer, symbols]) => ({
    layer,
    because: [...symbols],
  }));

const renumbered = (
  cohort: ProposedCohort,
  layers: readonly Remaining[],
  into: number | null,
): ProposedCohort | null => {
  const kept = layers.flatMap((each, l) =>
    each.emptied ? [] : [{ ...each, from: l + 1 }],
  );
  const places = new Map(kept.map(({ from }, place) => [from, place + 1]));
  const emptied = new Set(
    layers.flatMap((each, l) => (each.emptied ? [l + 1] : [])),
  );
  const shifted = (layer: number) =>
    Number.isInteger(layer) && layer > 0
      ? layer - [...emptied].filter((each) => each < layer).length
      : layer;
  const numberOf = (layer: number, unchecked = false) =>
    emptied.has(layer) && !unchecked
      ? into === null
        ? undefined
        : places.get(into + 1)
      : shifted(layer);
  const inherited = layers.flatMap(({ layer, emptied }) =>
    emptied ? layer.dependsOn : [],
  );

  const layersAfter = kept.map(({ layer, from }, at) => {
    const own = layer.dependsOn.map((dependency) => {
      const unchecked =
        into === null &&
        emptied.has(dependency.layer) &&
        dependency.layer >= from;

      return {
        dependency,
        remapped: emptied.has(dependency.layer) && !unchecked,
        unchecked,
      };
    });
    const moved =
      into !== null && from === into + 1
        ? inherited.map((dependency) => ({ dependency, remapped: true }))
        : [];
    const dependsOn = renumberedDependencies(
      [...own, ...moved],
      numberOf,
      at + 1,
    );

    return dependsOn
      ? { ...layer, dependsOn: into === null ? dependsOn : merged(dependsOn) }
      : null;
  });

  return layersAfter.every((layer) => layer !== null)
    ? { ...cohort, layers: layersAfter }
    : null;
};

export const withoutHunks = (
  diff: Diff,
  cohort: ProposedCohort,
  hunks: readonly HunkId[],
): ProposedCohort | null => {
  const leaving = new Set<string>(hunks);
  const layers = cohort.layers.map((layer): Remaining => {
    const remaining = layerWithout(diff, layer, leaving);

    return {
      ...remaining,
      layer: {
        ...remaining.layer,
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

const withInheritedNotes = (
  notes: readonly FileNote[],
  inherited: readonly { note: FileNote; leaves: boolean }[],
): FileNote[] => {
  const all = [...notes];

  for (const { note, leaves } of inherited) {
    const at = all.findIndex((each) => each.path === note.path);
    const present = all[at];

    if (!present) {
      all.push(note);
    } else if (leaves && present.note !== note.note) {
      all[at] = { ...present, note: `${present.note}\n\n${note.note}` };
    }
  }

  return all;
};

export const withHunksMovedInto = (
  diff: Diff,
  cohort: ProposedCohort,
  hunks: readonly HunkId[],
  target: number,
  definesOf?: (hunk: HunkId) => readonly string[],
): ProposedCohort | null => {
  const targetLayer = cohort.layers[target];

  if (!targetLayer) {
    return null;
  }

  const moving = new Set<string>(hunks);
  const added = hunks.filter(
    (hunk) => !targetLayer.hunks.some((entry) => entry.hunk === hunk),
  );
  const remaining = cohort.layers.map((layer, l) =>
    l === target
      ? {
          layer: {
            ...layer,
            hunks: [...layer.hunks, ...added.map((hunk) => ({ hunk }))],
          },
          emptied: false,
        }
      : layerWithout(diff, layer, moving),
  );
  const loses = (l: number) =>
    l !== target &&
    !remaining[l]?.emptied &&
    (cohort.layers[l]?.hunks.some((entry) => moving.has(entry.hunk)) ?? false);
  const mayCiteMovedCode = (layer: ProposedLayer, l: number): boolean =>
    cohort.layers.some(
      (other, m) =>
        m !== l && other.dependsOn.some((each) => each.layer === l + 1),
    ) ||
    (l > target &&
      layer.dependsOn.some(
        (each) => each.layer > target + 1 && each.layer <= l,
      ));
  if (
    !definesOf &&
    cohort.layers.some((layer, l) => loses(l) && mayCiteMovedCode(layer, l))
  ) {
    return null;
  }

  const movedSymbols = cohort.layers.map((layer, l) => {
    if (!definesOf || !loses(l)) {
      return new Set<string>();
    }

    const staying = new Set(
      layer.hunks
        .filter((entry) => !moving.has(entry.hunk))
        .flatMap((entry) => definesOf(entry.hunk)),
    );

    return new Set(
      layer.hunks
        .filter((entry) => moving.has(entry.hunk))
        .flatMap((entry) => definesOf(entry.hunk))
        .filter((symbol) => !staying.has(symbol)),
    );
  });
  const withoutMovedSymbols = (
    dependsOn: ProposedLayer['dependsOn'],
  ): ProposedLayer['dependsOn'] =>
    dependsOn.flatMap((each) => {
      const moved = movedSymbols[each.layer - 1];

      if (!moved || moved.size === 0) {
        return [each];
      }

      const because = each.because.filter((symbol) => !moved.has(symbol));
      return because.length > 0 ? [{ ...each, because }] : [];
    });

  const inheritedNotes = cohort.layers.flatMap((layer, l) => {
    const paths = pathsOf(
      diff,
      layer.hunks.filter((entry) => l !== target && moving.has(entry.hunk)),
    );
    const still = pathsOf(diff, remaining[l]?.layer.hunks ?? []);

    return layer.notes
      .filter((each) => paths.has(each.path))
      .map((note) => ({ note, leaves: !still.has(note.path) }));
  });

  const arriving = new Set<string>(added);
  const reassigned = (l: number, question: ProposedQuestion) =>
    l !== target &&
    (remaining[l]?.emptied ||
      (l < target && question.hunks.some((hunk) => arriving.has(hunk))));
  const shownBefore = (l: number, question: ProposedQuestion) => {
    const shownAt = shownHunks(cohort.layers, l);
    return (
      question.hunks.length > 0 &&
      question.hunks.every((hunk) => shownAt.has(hunk))
    );
  };
  const shown: Set<string>[] = [];
  const shownBy = (at: number): Set<string> => {
    const cached = shown[at];

    if (cached) {
      return cached;
    }

    const computed = shownHunks(
      remaining.map(({ layer }) => layer),
      at,
    );
    shown[at] = computed;
    return computed;
  };
  const questionsByLayer = remaining.map(({ layer }, l) =>
    layer.questions.filter((each) => !reassigned(l, each)),
  );

  for (const [l, layer] of cohort.layers.entries()) {
    for (const question of layer.questions.filter(
      (each) => reassigned(l, each) && shownBefore(l, each),
    )) {
      const destination = remaining.findIndex(
        (each, at) =>
          at >= target &&
          !each.emptied &&
          (questionsByLayer[at]?.length ?? 0) < MAX_QUESTIONS &&
          question.hunks.every((hunk) => shownBy(at).has(hunk)),
      );

      questionsByLayer[destination < 0 ? target : destination]?.push(question);
    }
  }

  return renumbered(
    cohort,
    remaining.map(({ layer, emptied }, l) => ({
      emptied,
      layer: {
        ...layer,
        dependsOn: withoutMovedSymbols(layer.dependsOn),
        summary:
          l === target
            ? [
                ...new Set([
                  layer.summary,
                  ...remaining.flatMap((each) =>
                    each.emptied ? [each.layer.summary] : [],
                  ),
                ]),
              ].join(' ')
            : layer.summary,
        notes:
          l === target
            ? withInheritedNotes(layer.notes, inheritedNotes)
            : layer.notes,
        questions: questionsByLayer[l] ?? [],
      },
    })),
    target,
  );
};
