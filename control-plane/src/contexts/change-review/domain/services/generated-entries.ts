import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type { CheckEntry } from '@change-review/domain/value-objects/stack-check.vo';
import type { StackCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import type { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { itemAt } from '@shared-kernel/domain/item-at';

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

    for (let next = waiting.pop(); next !== undefined; next = waiting.pop()) {
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
        for (const entry of layer.hunks) {
          const path = diff.fileOf(entry.hunk)?.path;

          if (path !== undefined && path !== '') {
            const earliest = layerOf.get(path);

            layerOf.set(
              path,
              earliest === undefined ? place : Math.min(earliest, place),
            );
          }
        }
      });

      return generated.flatMap((file) => {
        const places = [...importersOf(file.path)].flatMap((path) => {
          const place = layerOf.get(path);

          return place === undefined ? [] : [place];
        });

        if (places.length === 0) {
          return [];
        }

        const layer = itemAt(cohort.layers, Math.min(...places));

        return layer
          ? file.hunks.map((hunk) => ({ hunk: hunk.id, layer: layer.id }))
          : [];
      });
    });
};
