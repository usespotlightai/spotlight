import type {
  FileClass,
  LinkKind,
} from '@change-review/domain/services/diff-facts';
import type { DiffFileStatus } from '@change-review/domain/value-objects/diff.vo';
import type { CheckStatusView } from '@change-review/domain/value-objects/stack-check.vo';
import type { CohortKind } from '@change-review/domain/value-objects/stack-cohort.vo';

interface StoredHunk {
  readonly id: string;
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly patch: string;
}

export interface StoredFile {
  readonly path: string;
  readonly previousPath: string | null;
  readonly status: DiffFileStatus;
  readonly binary: boolean;
  readonly hunks: readonly StoredHunk[];
}

interface StoredNote {
  readonly path: string;
  readonly note: string;
}

interface StoredLayer {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly dependsOn: readonly {
    readonly layer: string;
    readonly because: readonly string[];
  }[];
  readonly hunks: readonly { readonly hunk: string }[];
  readonly notes: readonly StoredNote[];
}

export interface StoredCohort {
  readonly id: string;
  readonly kind: CohortKind;
  readonly title: string;
  readonly intent: string;
  readonly layers: readonly StoredLayer[];
}

interface StoredHunkFacts {
  readonly hunk: string;
  readonly path: string;
  readonly fileClass: FileClass;
  readonly incidental: boolean;
  readonly renamed: boolean;
  readonly moved: boolean;
  readonly linkable: boolean;
  readonly defines: readonly string[];
  readonly outside: readonly string[];
}

export interface StoredFacts {
  readonly hunks: readonly StoredHunkFacts[];
  readonly links: readonly {
    readonly kind: LinkKind;
    readonly from: string;
    readonly to: string;
    readonly because: readonly string[];
  }[];
  readonly imports: readonly { readonly from: string; readonly to: string }[];
}

export interface StoredStep {
  readonly step: string;
  readonly passed: boolean;
  readonly output: string;
  readonly durationMs: number;
}

export interface StoredCheckEntry {
  readonly hunk: string;
  readonly layer: string;
}

export interface StoredCheckOutcome {
  readonly status: Exclude<CheckStatusView, 'waiting'>;
  readonly skip: {
    readonly code: string;
    readonly detail: string | null;
  } | null;
  readonly whole: StoredStep | null;
  readonly layers: readonly StoredStep[];
  readonly checkedAt: string;
}
