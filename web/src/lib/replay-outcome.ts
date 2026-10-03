import type { StackCheckResponseDto } from '@/lib/api';
import type { ChangeStack } from '@/lib/change-stack';
import {
  type FileChange,
  fileName,
  type LineRange,
  repoRelative,
} from '@/lib/changes';
import type { ReplayEntry } from '@/lib/replay';

export type StackCheck = StackCheckResponseDto;

export type CheckedStep = StackCheck['layers'][number];

export interface CitedHunk {
  readonly id: string;
  readonly path: string;
  readonly lines: LineRange;
}

export const hunkIn = (
  stacks: readonly ChangeStack[],
  id: string,
): CitedHunk | null => {
  for (const stack of stacks) {
    for (const file of stack.files) {
      const hunk = file.hunks.find((each) => each.id === id);

      if (hunk) {
        return {
          id,
          path: file.path,
          lines: {
            start: hunk.newStart,
            end: hunk.newStart + Math.max(hunk.newLines, 1) - 1,
          },
        };
      }
    }
  }

  return null;
};

export const fileAt = (
  files: readonly FileChange[],
  path: string,
): FileChange | null =>
  files.find((file) => {
    const own = repoRelative(file.path);
    return own === path || own.endsWith(`/${path}`) || path.endsWith(`/${own}`);
  }) ?? null;

export const hunkShown = (hunk: CitedHunk): string =>
  hunk.lines.start === hunk.lines.end
    ? `${fileName(hunk.path)}, line ${hunk.lines.start}`
    : `${fileName(hunk.path)}, lines ${hunk.lines.start}–${hunk.lines.end}`;

const WHY: Record<ReplayEntry['result'], string | null> = {
  pending: null,
  succeeded: 'Why it succeeded',
  failed: 'Why it failed',
  unscored: 'Why it went unscored',
};

export const whyTitle = (result: ReplayEntry['result']): string | null =>
  WHY[result];

export const stepsOf = (check: StackCheck): CheckedStep[] => [
  ...(check.whole ? [check.whole] : []),
  ...check.layers,
];

export const stepName = (step: CheckedStep): string =>
  step.step === 'whole' ? 'The whole change' : step.step;
