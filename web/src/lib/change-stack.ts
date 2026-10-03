import type {
  ChangeStackResponseDto,
  DiffFileResponseDto,
  DiffHunkResponseDto,
  RunChangeStacksResponseDto,
  StackCohortResponseDto,
  StackLayerResponseDto,
} from '@/lib/api';
import { runPath } from '@/lib/run';

export type RunChangeStacks = RunChangeStacksResponseDto;

export type ChangeStack = ChangeStackResponseDto;

export type StackCohort = StackCohortResponseDto;

export type StackLayer = StackLayerResponseDto;

export type DiffFile = DiffFileResponseDto;

export type DiffHunk = DiffHunkResponseDto;

export interface LayerFile {
  readonly file: DiffFile;
  readonly hunks: readonly DiffHunk[];
  readonly note: string | null;
}

export interface LocatedLayer {
  readonly cohort: StackCohort;
  readonly layer: StackLayer;
  readonly position: number;
}

export const changeStackPath = (
  slug: string,
  teamId: string,
  runId: string,
): string => `${runPath(slug, teamId, runId)}/changes`;

export const currentStacks = (
  stacks: readonly ChangeStack[],
): ChangeStack[] => {
  const seen = new Set<string | null>();

  return stacks.filter((stack) => {
    if (seen.has(stack.repository)) {
      return false;
    }
    seen.add(stack.repository);
    return true;
  });
};

export const drafting = (stacks: readonly ChangeStack[]): boolean =>
  currentStacks(stacks).some((stack) => stack.state === 'drafting');

export const settling = (stacks: readonly ChangeStack[]): boolean =>
  currentStacks(stacks).some(
    (stack) => stack.state === 'drafting' || stack.check?.state === 'waiting',
  );

export const layersOf = (stack: ChangeStack): LocatedLayer[] =>
  stack.cohorts.flatMap((cohort) =>
    cohort.layers.map((layer, place) => ({
      cohort,
      layer,
      position: place + 1,
    })),
  );

export const layerAt = (
  stack: ChangeStack,
  id: string | null,
): LocatedLayer | null => {
  const layers = layersOf(stack);

  return layers.find((each) => each.layer.id === id) ?? layers[0] ?? null;
};

export const filesOf = (stack: ChangeStack, layer: StackLayer): LayerFile[] => {
  const placed = new Set(layer.ranges.map((range) => range.hunk));
  const notes = new Map(layer.notes.map((each) => [each.path, each.note]));

  return stack.files.flatMap((file) => {
    const hunks = file.hunks.filter((hunk) => placed.has(hunk.id));

    return hunks.length > 0
      ? [{ file, hunks, note: notes.get(file.path) ?? null }]
      : [];
  });
};

export const patchOf = (file: DiffFile, hunk: DiffHunk): string => {
  const before =
    file.status === 'added'
      ? '/dev/null'
      : `a/${file.previousPath ?? file.path}`;
  const after = file.status === 'deleted' ? '/dev/null' : `b/${file.path}`;

  return `--- ${before}\n+++ ${after}\n${hunk.patch}\n`;
};

export const layerTallyOf = (
  files: readonly LayerFile[],
): { added: number; removed: number } =>
  tallyOf(files.flatMap((placed) => placed.hunks));

export const cohortTallyOf = (
  stack: ChangeStack,
  cohort: StackCohort,
): { files: number; added: number; removed: number } => {
  const placed = cohort.layers.flatMap((layer) => filesOf(stack, layer));

  return {
    files: new Set(placed.map((each) => each.file.path)).size,
    ...layerTallyOf(placed),
  };
};

export const linesOf = (hunks: readonly DiffHunk[]): number =>
  hunks.reduce((rows, hunk) => rows + hunk.patch.split('\n').length, 0);

export const tallyOf = (
  hunks: readonly DiffHunk[],
): { added: number; removed: number } => {
  let added = 0;
  let removed = 0;

  for (const hunk of hunks) {
    for (const line of hunk.patch.split('\n').slice(1)) {
      if (line.startsWith('+')) {
        added += 1;
      } else if (line.startsWith('-')) {
        removed += 1;
      }
    }
  }

  return { added, removed };
};

export const STACK_NAV_PANE = {
  storageKey: 'spotlight.change-stack-nav-width',
  min: 224,
  max: 560,
  initial: 288,
  label: 'Resize the change stack',
};
