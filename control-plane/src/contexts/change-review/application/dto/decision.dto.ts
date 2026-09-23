export const DECISION_KIND_NAMES = [
  'trade-off',
  'assumption',
  'limitation',
  'rejected-approach',
  'deviation',
] as const;

export const DECISION_STANDING_NAMES = ['proposed', 'stands'] as const;

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
  readonly steps: readonly number[];
  readonly disputes: readonly DisputeDto[];
}

export interface DecisionMergeDto {
  readonly repository: string;
  readonly commit: string;
  readonly at: Date;
}

export interface TaskDecisionsDto {
  readonly runId: string | null;
  readonly drafting: boolean;
  readonly standing: (typeof DECISION_STANDING_NAMES)[number];
  readonly merge: DecisionMergeDto | null;
  readonly decisions: readonly DecisionDto[];
}

export interface StandingDecisionsDto {
  readonly taskId: string;
  readonly runId: string | null;
  readonly repository: string;
  readonly commit: string;
  readonly mergedAt: Date;
  readonly decisions: readonly DecisionDto[];
}

export const NO_DECISIONS: TaskDecisionsDto = {
  runId: null,
  drafting: false,
  standing: 'proposed',
  merge: null,
  decisions: [],
};
