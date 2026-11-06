import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import { factProblems } from '@change-review/domain/services/fact-rules';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type {
  ProposedCohort,
  ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

const movedGroups = (facts: DiffFacts): HunkId[][] => {
  const parent = new Map<HunkId, HunkId>();
  const root = (hunk: HunkId): HunkId => {
    const above = parent.get(hunk) ?? hunk;
    return above === hunk ? hunk : root(above);
  };

  for (const { kind, from, to } of facts.links) {
    if (kind === 'moves') {
      parent.set(from, parent.get(from) ?? from);
      parent.set(to, parent.get(to) ?? to);
      parent.set(root(from), root(to));
    }
  }

  const groups = new Map<HunkId, HunkId[]>();

  for (const hunk of parent.keys()) {
    groups.set(root(hunk), [...(groups.get(root(hunk)) ?? []), hunk]);
  }

  return [...groups.values()];
};

const layerIndexOf = (cohort: ProposedCohort, hunk: HunkId): number =>
  cohort.layers.findIndex((layer) =>
    layer.hunks.some((entry) => entry.hunk === hunk),
  );

const placedIn = (
  diff: Diff,
  cohort: ProposedCohort,
  group: readonly HunkId[],
  target: number,
): ProposedCohort => {
  const moving = new Set<string>(group);
  const pathOf = (hunk: HunkId) => diff.fileOf(hunk)?.path ?? null;
  const pathsOf = (hunks: ProposedLayer['hunks']) =>
    new Set(hunks.map((entry) => pathOf(entry.hunk)));
  const carried = new Map(
    cohort.layers.flatMap((layer) => {
      const paths = pathsOf(
        layer.hunks.filter((entry) => moving.has(entry.hunk)),
      );
      return layer.notes
        .filter((each) => paths.has(each.path))
        .map((each) => [each.path, each] as const);
    }),
  );

  const layers = cohort.layers.map((layer, l): ProposedLayer => {
    if (l === target) {
      const arriving = group.filter(
        (hunk) => !layer.hunks.some((entry) => entry.hunk === hunk),
      );
      const noted = new Set(layer.notes.map((each) => each.path));
      const notes = [...layer.notes];

      for (const hunk of arriving) {
        const path = pathOf(hunk);
        const note = path === null ? undefined : carried.get(path);

        if (path !== null && note && !noted.has(path)) {
          notes.push(note);
          noted.add(path);
        }
      }

      return {
        ...layer,
        hunks: [...layer.hunks, ...arriving.map((hunk) => ({ hunk }))],
        notes,
      };
    }

    const hunks = layer.hunks.filter((entry) => !moving.has(entry.hunk));
    const before = pathsOf(layer.hunks);
    const still = pathsOf(hunks);

    return {
      ...layer,
      hunks,
      notes: layer.notes.filter(
        (each) => still.has(each.path) || !before.has(each.path),
      ),
    };
  });

  const kept = layers.flatMap((layer, l) =>
    layer.hunks.length > 0 ? [{ layer, from: l + 1 }] : [],
  );
  const renumbered = new Map(kept.map(({ from }, place) => [from, place + 1]));

  return {
    ...cohort,
    layers: kept.map(({ layer }) => ({
      ...layer,
      dependsOn: layer.dependsOn.flatMap((dependency) => {
        const now = renumbered.get(dependency.layer);
        return now ? [{ ...dependency, layer: now }] : [];
      }),
    })),
  };
};

const togetherIn = (
  diff: Diff,
  facts: DiffFacts,
  cohorts: readonly ProposedCohort[],
  group: readonly HunkId[],
): ProposedCohort[] => {
  const c = cohorts.findIndex((cohort) =>
    group.every((hunk) => layerIndexOf(cohort, hunk) >= 0),
  );
  const cohort = cohorts[c];

  if (!cohort) {
    return [...cohorts];
  }

  const targets = [
    ...new Set(group.map((hunk) => layerIndexOf(cohort, hunk))),
  ].sort((a, b) => b - a);

  if (targets.length < 2) {
    return [...cohorts];
  }

  const candidates = targets.map((target) =>
    cohorts.map((each, at) =>
      at === c ? placedIn(diff, each, group, target) : each,
    ),
  );
  const broken = candidates.map(
    (candidate) => factProblems(candidate, facts).length,
  );

  return candidates[broken.indexOf(Math.min(...broken))] ?? [...cohorts];
};

export const withMovedCodeTogether = (
  diff: Diff,
  facts: DiffFacts,
  cohorts: readonly ProposedCohort[],
): ProposedCohort[] =>
  movedGroups(facts).reduce(
    (arranged, group) => togetherIn(diff, facts, arranged, group),
    [...cohorts],
  );
