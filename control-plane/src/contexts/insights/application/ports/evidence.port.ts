import type {
  JudgedHunk,
  JudgedStep,
} from '@insights/domain/services/judge-evidence';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const EVIDENCE = Symbol('INSIGHTS_EVIDENCE');

export interface RunEvidence {
  readonly runId: RunId;
  readonly taskId: TaskId;
  readonly title: string;
  readonly description: string | null;
  readonly steps: readonly JudgedStep[];
  readonly hunks: readonly JudgedHunk[];
}

export interface EvidencePort {
  hasTask(runId: RunId): Promise<boolean>;

  of(runId: RunId): Promise<RunEvidence | null>;
}
