import type {
  CohortId,
  HunkId,
  LayerId,
} from '@change-review/domain/value-objects/stack-ids';

export const COHORT_KINDS = ['change', 'incidental'] as const;

export type CohortKind = (typeof COHORT_KINDS)[number];

export const needsFileNotes = (kind: CohortKind): boolean => kind === 'change';

interface StackHunk {
  readonly hunk: HunkId;
}

export interface FileNote {
  readonly path: string;
  readonly note: string;
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
}

export interface StackCohort {
  readonly id: CohortId;
  readonly kind: CohortKind;
  readonly title: string;
  readonly intent: string;
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
}

export interface ProposedCohort {
  readonly kind: CohortKind;
  readonly title: string;
  readonly intent: string;
  readonly joinedBecause?: string | null;
  readonly layers: readonly ProposedLayer[];
}
