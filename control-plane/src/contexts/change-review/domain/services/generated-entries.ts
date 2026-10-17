import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type { CheckEntry } from '@change-review/domain/value-objects/stack-check.vo';
import type { StackCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import type { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';

export const generatedEntries = (
  diff: Diff,
  cohorts: readonly StackCohort[],
  facts: StackFacts,
): CheckEntry[] => {
  const importers = new Map<string, Set<string>>();

  for (const { from, to } of facts.imports) {
    importers.set(to, (importers.get(to) ?? new Set()).add(from));
  }

  const importersOf = (path: string): Set<string> => {
    const seen = new Set<string>();
    const waiting = [path];

    while (waiting.length > 0) {
      const next = waiting.pop() as string;

      for (const importer of importers.get(next) ?? []) {
        if (!seen.has(importer)) {
          seen.add(importer);
          waiting.push(importer);
        }
      }
    }

    return seen;
  };

  const generated = diff.files.filter(
    (file) =>
      !file.binary && file.hunks.some((hunk) => facts.isGenerated(hunk.id)),
  );

  return cohorts
    .filter((cohort) => cohort.kind === 'change')
    .flatMap((cohort) => {
      const layerOf = new Map<string, number>();

      cohort.layers.forEach((layer, place) => {
        for (const range of layer.ranges) {
          const path = diff.fileOf(range.hunk)?.path;

          if (path && !layerOf.has(path)) {
            layerOf.set(path, place);
          } else if (path) {
            layerOf.set(path, Math.min(layerOf.get(path) as number, place));
          }
        }
      });

      return generated.flatMap((file) => {
        const places = [...importersOf(file.path)].flatMap((path) =>
          layerOf.has(path) ? [layerOf.get(path) as number] : [],
        );

        if (places.length === 0) {
          return [];
        }

        const layer = cohort.layers[Math.min(...places)];

        return layer
          ? file.hunks.map((hunk) => ({ hunk: hunk.id, layer: layer.id }))
          : [];
      });
    });
};
