export const DECISION_KIND_NAMES = [
  'trade-off',
  'assumption',
  'limitation',
  'rejected-approach',
  'deviation',
] as const;

export const DECISION_STATUS_NAMES = ['proposed', 'merged'] as const;

export interface DisputeDto {
  readonly id: string;
  readonly path: string;
  readonly by: string;
  readonly byName: string | null;
  readonly reason: string;
  readonly at: Date;
}

export interface DecisionDto {
  readonly id: string;
  readonly kind: (typeof DECISION_KIND_NAMES)[number];
  readonly title: string;
  readonly why: string;
  readonly alternatives: readonly string[];
  readonly paths: readonly string[];
  /** The run whose agent recorded it. */
  readonly runId: string;
  /** Steps of that run's journal; only decisions drafted before agents recorded their own cite any. */
  readonly journalSteps: readonly number[];
  readonly disputes: readonly DisputeDto[];
}

export interface DecisionMergeDto {
  readonly repository: string;
  readonly commit: string;
  readonly at: Date;
}

export interface TaskDecisionsDto {
  readonly status: (typeof DECISION_STATUS_NAMES)[number];
  readonly merges: readonly DecisionMergeDto[];
  readonly decisions: readonly DecisionDto[];
}

export interface MergedDecisionsDto {
  readonly taskId: string;
  readonly repository: string;
  readonly commit: string;
  readonly mergedAt: Date;
  readonly decisions: readonly DecisionDto[];
}

export const NO_DECISIONS: TaskDecisionsDto = {
  status: 'proposed',
  merges: [],
  decisions: [],
};
