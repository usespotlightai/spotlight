import type {
  ChangeStackResponseDto,
  DiffFileResponseDto,
  DiffHunkResponseDto,
  RunChangeStacksResponseDto,
  StackCheckResponseDto,
  StackCohortResponseDto,
  StackLayerResponseDto,
} from '@/lib/api';
import { runPath } from '@/lib/run';

export type RunChangeStacks = RunChangeStacksResponseDto;

export type ChangeStack = ChangeStackResponseDto;

export type StackCheck = StackCheckResponseDto;

export type StackCohort = StackCohortResponseDto;

export type StackLayer = StackLayerResponseDto;

export type DiffFile = DiffFileResponseDto;

export type DiffHunk = DiffHunkResponseDto;

export interface PlacedHunk {
  readonly hunk: DiffHunk;
  readonly summary: string | null;
}

export interface LayerFile {
  readonly file: DiffFile;
  readonly hunks: readonly PlacedHunk[];
}

export interface LocatedLayer {
  readonly cohort: StackCohort;
  readonly layer: StackLayer;
  readonly position: number;
}

export type LayerCheck =
  | { readonly state: 'none' }
  | { readonly state: 'waiting'; readonly command: string }
  | {
      readonly state: 'passed' | 'failed';
      readonly command: string;
      readonly output: string;
      readonly tookMs: number;
    }
  | {
      readonly state: 'skipped';
      readonly command: string;
      readonly reason: string | null;
    };

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

export const layerCheckOf = (
  stack: ChangeStack,
  located: LocatedLayer,
): LayerCheck => {
  const check = stack.check;

  if (!check || located.cohort.kind !== 'change') {
    return { state: 'none' };
  }
  if (check.state === 'waiting') {
    return { state: 'waiting', command: check.command };
  }

  const checked = check.layers.find((each) => each.step === located.layer.id);

  return checked
    ? {
        state: checked.passed ? 'passed' : 'failed',
        command: check.command,
        output: checked.output,
        tookMs: checked.tookMs,
      }
    : { state: 'skipped', command: check.command, reason: check.reason };
};

export const tookFor = (ms: number): string => {
  const seconds = Math.max(1, Math.round(ms / 1000));

  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

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
  const placed = new Map(layer.ranges.map((range) => [range.hunk, range]));

  return stack.files.flatMap((file) => {
    const hunks = file.hunks.flatMap((hunk) => {
      const range = placed.get(hunk.id);
      return range ? [{ hunk, summary: range.summary }] : [];
    });

    return hunks.length > 0 ? [{ file, hunks }] : [];
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
