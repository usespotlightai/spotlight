import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

const PATH = /[\w@.-]+(?:\/[\w@.-]+)+\.[a-z]{1,5}/g;

interface RedraftedLayer {
  readonly title: string;
  readonly hunks: readonly HunkId[];
}

interface RedraftedCohort {
  readonly title: string;
  readonly layers: readonly RedraftedLayer[];
}

interface NamedHunk {
  readonly hunk: HunkId;
  readonly layer: number | null;
}

interface NamedFile {
  readonly path: string;
  readonly hunks: readonly NamedHunk[];
}

interface FailedLayer {
  readonly cohort: number;
  readonly layer: number;
  readonly title: string;
  readonly output: string;
  readonly named: readonly NamedFile[];
}

export interface RedraftRequest {
  readonly command: string;
  readonly stack: readonly RedraftedCohort[];
  readonly failed: readonly FailedLayer[];
}

export const redraftRequestOf = (
  stack: ChangeStack,
  check: StackCheck,
): RedraftRequest | null => {
  const outcome = check.outcome;

  if (outcome?.status !== 'checked') {
    return null;
  }

  const assigned = new Map<HunkId, { cohort: number; layer: number }>();

  stack.cohorts.forEach((cohort, c) => {
    cohort.layers.forEach((layer, l) => {
      for (const entry of layer.hunks) {
        assigned.set(entry.hunk, { cohort: c, layer: l });
      }
    });
  });

  const failed = outcome.layers
    .filter((checked) => !checked.passed)
    .flatMap((checked): FailedLayer[] => {
      const cohortAt = stack.cohorts.findIndex((cohort) =>
        cohort.layers.some((layer) => layer.id === checked.step),
      );
      const cohort = stack.cohorts[cohortAt];
      const layerAt =
        cohort?.layers.findIndex((layer) => layer.id === checked.step) ?? -1;
      const layer = cohort?.layers[layerAt];

      if (!cohort || !layer) {
        return [];
      }

      const named = [...new Set(checked.output.match(PATH) ?? [])].flatMap(
        (path): NamedFile[] => {
          const file = stack.diff.files.find(
            (each) => each.path === path || each.path.endsWith(`/${path}`),
          );

          return file
            ? [
                {
                  path: file.path,
                  hunks: file.hunks.map((hunk) => {
                    const at = assigned.get(hunk.id);
                    return {
                      hunk: hunk.id,
                      layer: at?.cohort === cohortAt ? at.layer : null,
                    };
                  }),
                },
              ]
            : [];
        },
      );

      return [
        {
          cohort: cohortAt,
          layer: layerAt,
          title: layer.title,
          output: checked.output,
          named,
        },
      ];
    });

  return failed.length === 0
    ? null
    : {
        command: check.request.command,
        stack: stack.cohorts.map((cohort) => ({
          title: cohort.title,
          layers: cohort.layers.map((layer) => ({
            title: layer.title,
            hunks: layer.hunks.map((entry) => entry.hunk),
          })),
        })),
        failed,
      };
};
