import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

const PATH = /[\w@.-]+(?:\/[\w@.-]+)+\.[a-z]{1,5}/g;

export interface RevisedLayer {
  readonly title: string;
  readonly hunks: readonly HunkId[];
}

export interface RevisedCohort {
  readonly title: string;
  readonly layers: readonly RevisedLayer[];
}

export interface NamedHunk {
  readonly hunk: HunkId;
  readonly layer: number | null;
}

export interface NamedFile {
  readonly path: string;
  readonly hunks: readonly NamedHunk[];
}

export interface FailedLayer {
  readonly cohort: number;
  readonly layer: number;
  readonly title: string;
  readonly output: string;
  readonly named: readonly NamedFile[];
}

export interface StackRevision {
  readonly command: string;
  readonly stack: readonly RevisedCohort[];
  readonly failed: readonly FailedLayer[];
}

export const revisionOf = (stack: ChangeStack): StackRevision | null => {
  const outcome = stack.check?.outcome;

  if (!stack.check || outcome?.state !== 'checked') {
    return null;
  }

  const placed = new Map<HunkId, { cohort: number; layer: number }>();

  stack.cohorts.forEach((cohort, c) => {
    cohort.layers.forEach((layer, l) => {
      for (const range of layer.ranges) {
        placed.set(range.hunk, { cohort: c, layer: l });
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
                    const at = placed.get(hunk.id);
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
        command: stack.check.command,
        stack: stack.cohorts.map((cohort) => ({
          title: cohort.title,
          layers: cohort.layers.map((layer) => ({
            title: layer.title,
            hunks: layer.ranges.map((range) => range.hunk),
          })),
        })),
        failed,
      };
};
