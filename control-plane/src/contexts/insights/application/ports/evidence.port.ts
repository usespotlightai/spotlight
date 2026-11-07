import type {
  JudgedHunk,
  JudgedStep,
} from '@insights/domain/services/judge-evidence';

export const EVIDENCE = Symbol('INSIGHTS_EVIDENCE');

export interface RunEvidence {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly description: string | null;
  readonly steps: readonly JudgedStep[];
  readonly hunks: readonly JudgedHunk[];
}

export interface EvidencePort {
  hasTask(runId: string): Promise<boolean>;

  of(runId: string): Promise<RunEvidence | null>;
}
