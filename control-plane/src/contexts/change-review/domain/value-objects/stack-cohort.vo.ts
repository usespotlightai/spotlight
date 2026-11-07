import type {
  CohortId,
  HunkId,
  LayerId,
  QuestionId,
} from '@change-review/domain/value-objects/stack-ids';

export const COHORT_KINDS = ['change', 'incidental'] as const;

export type CohortKind = (typeof COHORT_KINDS)[number];

export const needsFileNotes = (kind: CohortKind): boolean => kind === 'change';

export const MAX_QUESTIONS = 2;

export const MAX_PROSE = 2_000;

export const asksQuestions = (kind: CohortKind): boolean => kind === 'change';

interface StackHunk {
  readonly hunk: HunkId;
}

export interface FileNote {
  readonly path: string;
  readonly note: string;
}

export interface ProposedQuestion {
  readonly question: string;
  readonly answer: string;
  readonly hunks: readonly HunkId[];
}

export interface LayerQuestion extends ProposedQuestion {
  readonly id: QuestionId;
}

export interface LayerDependency {
  readonly layer: LayerId;
  readonly because: readonly string[];
}

interface StackLayer {
  readonly id: LayerId;
  readonly title: string;
  readonly summary: string;
  readonly dependsOn: readonly LayerDependency[];
  readonly hunks: readonly StackHunk[];
  readonly notes: readonly FileNote[];
  readonly questions: readonly LayerQuestion[];
}

export interface StackCohort {
  readonly id: CohortId;
  readonly kind: CohortKind;
  readonly title: string;
  readonly intent: string;
  readonly joinedBecause: string | null;
  readonly layers: readonly StackLayer[];
}

export interface ProposedLayer {
  readonly title: string;
  readonly summary: string;
  readonly dependsOn: readonly {
    readonly layer: number;
    readonly because: readonly string[];
  }[];
  readonly hunks: readonly StackHunk[];
  readonly notes: readonly FileNote[];
  readonly questions: readonly ProposedQuestion[];
}

export interface ProposedCohort {
  readonly kind: CohortKind;
  readonly title: string;
  readonly intent: string;
  readonly joinedBecause?: string | null;
  readonly layers: readonly ProposedLayer[];
}

export interface OutlinedCohort {
  readonly kind: CohortKind;
  readonly title: string;
  readonly intent: string;
  readonly joinedBecause: string | null;
  readonly hunks: readonly HunkId[];
}

export interface DraftedLayer
  extends Omit<ProposedLayer, 'hunks' | 'questions'> {
  readonly hunks: readonly { readonly hunk: string }[];
  readonly questions: readonly {
    readonly question: string;
    readonly answer: string;
    readonly hunks: readonly string[];
  }[];
}

export interface DraftedCohort extends Omit<ProposedCohort, 'layers'> {
  readonly layers: readonly DraftedLayer[];
}

export interface DraftedOutline extends Omit<OutlinedCohort, 'hunks'> {
  readonly hunks: readonly string[];
}
