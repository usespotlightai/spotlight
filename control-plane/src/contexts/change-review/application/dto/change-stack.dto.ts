export const CHANGE_STACK_STATE_NAMES = [
  'generating',
  'ready',
  'failed',
] as const;

export const STACK_CHECK_STATUS_NAMES = [
  'waiting',
  'checked',
  'skipped',
] as const;

export const COHORT_KIND_NAMES = ['change', 'incidental'] as const;

export const DIFF_FILE_STATUS_NAMES = [
  'added',
  'deleted',
  'modified',
  'renamed',
] as const;

interface DiffHunkDto {
  readonly id: string;
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly patch: string;
}

interface DiffFileDto {
  readonly path: string;
  readonly previousPath: string | null;
  readonly status: (typeof DIFF_FILE_STATUS_NAMES)[number];
  readonly binary: boolean;
  readonly hunks: readonly DiffHunkDto[];
}

interface StackLayerDto {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly dependsOn: readonly {
    readonly layer: string;
    readonly because: readonly string[];
  }[];
  readonly hunks: readonly {
    readonly hunk: string;
  }[];
  readonly notes: readonly {
    readonly path: string;
    readonly note: string;
  }[];
}

export interface StackCohortDto {
  readonly id: string;
  readonly kind: (typeof COHORT_KIND_NAMES)[number];
  readonly title: string;
  readonly intent: string;
  readonly layers: readonly StackLayerDto[];
}

export interface CheckedStepDto {
  readonly step: string;
  readonly passed: boolean;
  readonly output: string;
  readonly durationMs: number;
}

export interface StackCheckDto {
  readonly command: string;
  readonly status: (typeof STACK_CHECK_STATUS_NAMES)[number];
  readonly reason: string | null;
  readonly whole: CheckedStepDto | null;
  readonly layers: readonly CheckedStepDto[];
}

export interface ChangeStackDto {
  readonly id: string;
  readonly repository: string | null;
  readonly state: (typeof CHANGE_STACK_STATE_NAMES)[number];
  readonly failure: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly files: readonly DiffFileDto[];
  readonly cohorts: readonly StackCohortDto[];
  readonly check: StackCheckDto | null;
}

export interface RunChangeStacksDto {
  readonly stacks: readonly ChangeStackDto[];
}

export interface LatestChangeStackDto {
  readonly runId: string;
  readonly repository: string | null;
  readonly state: (typeof CHANGE_STACK_STATE_NAMES)[number];
  readonly checkStatus: (typeof STACK_CHECK_STATUS_NAMES)[number] | null;
  readonly added: number;
  readonly removed: number;
}
