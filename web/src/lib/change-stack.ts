import type {
  ChangeStackResponseDto,
  DiffFileResponseDto,
  DiffHunkResponseDto,
  LayerQuestionResponseDto,
  QuestionAnswerResponseDto,
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

export type LayerQuestion = LayerQuestionResponseDto;

export type QuestionAnswer = QuestionAnswerResponseDto;

export type AnswerVerdict = QuestionAnswer['verdict'];

export interface CitedPlace {
  readonly path: string;
  readonly line: number;
  readonly layerId: string | null;
}

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

export const generating = (stacks: readonly ChangeStack[]): boolean =>
  currentStacks(stacks).some((stack) => stack.state === 'generating');

export const inProgress = (stacks: readonly ChangeStack[]): boolean =>
  currentStacks(stacks).some(
    (stack) =>
      stack.state === 'generating' || stack.check?.status === 'waiting',
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
  const assigned = new Set(layer.hunks.map((each) => each.hunk));
  const notes = new Map(layer.notes.map((each) => [each.path, each.note]));

  return stack.files.flatMap((file) => {
    const hunks = file.hunks.filter((hunk) => assigned.has(hunk.id));

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

const LARGE_DIFF_LINES = 1_000;

export const isLargeDiff = (hunks: readonly DiffHunk[]): boolean =>
  linesOf(hunks) > LARGE_DIFF_LINES;

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

export const VERDICT_LABELS: Record<AnswerVerdict, string> = {
  right: 'Right',
  'partly-right': 'Partly right',
  missed: 'Missed',
};

export const citedBy = (
  stack: ChangeStack,
  question: LayerQuestion,
): CitedPlace[] => {
  const places = new Map<string, CitedPlace>();
  const layers = layersOf(stack);

  for (const id of question.hunks) {
    const file = stack.files.find((each) =>
      each.hunks.some((hunk) => hunk.id === id),
    );
    const hunk = file?.hunks.find((each) => each.id === id);
    const layer = layers.find((each) =>
      each.layer.hunks.some((entry) => entry.hunk === id),
    );

    if (file && hunk && !places.has(file.path)) {
      places.set(file.path, {
        path: file.path,
        line: hunk.newStart,
        layerId: layer?.layer.id ?? null,
      });
    }
  }

  return [...places.values()];
};

export const toReadAgain = (layer: StackLayer): boolean =>
  layer.questions.some(
    (each) =>
      each.answered !== null &&
      !each.answered.outdated &&
      each.answered.verdict !== 'right',
  );

export const REVISION_MARKS = {
  modified: {
    label: 'Changed',
    detail: 'This layer changed since the previous stack. Read it again.',
  },
  added: {
    label: 'New',
    detail: 'This layer is new since the previous stack.',
  },
} as const;

export const revisionMarkOf = (layer: StackLayer) =>
  layer.revision && layer.revision.status !== 'unchanged'
    ? REVISION_MARKS[layer.revision.status]
    : null;

export const answeredIn = (
  stacks: RunChangeStacks,
  stackId: string,
  answer: QuestionAnswer,
): RunChangeStacks => ({
  ...stacks,
  stacks: stacks.stacks.map((stack) =>
    stack.id === stackId
      ? {
          ...stack,
          cohorts: stack.cohorts.map((cohort) => ({
            ...cohort,
            layers: cohort.layers.map((layer) => ({
              ...layer,
              questions: layer.questions.map((each) =>
                each.id === answer.questionId
                  ? { ...each, answered: answer }
                  : each,
              ),
            })),
          })),
        }
      : stack,
  ),
});

export const STACK_NAV_PANE = {
  storageKey: 'spotlight.change-stack-nav-width',
  min: 224,
  max: 560,
  initial: 288,
  label: 'Resize the change stack',
};
