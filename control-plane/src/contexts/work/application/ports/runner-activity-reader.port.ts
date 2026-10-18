import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  RUN_SUBJECT_KINDS,
  type RunSubjectKind,
} from '@work/domain/value-objects/run-subject.vo';

export const LEASED_RUN_KINDS = [...RUN_SUBJECT_KINDS, 'spec'] as const;

export type LeasedRunKind = RunSubjectKind | 'spec';

export const RUNNER_ACTIVITY_READER = Symbol('RUNNER_ACTIVITY_READER');

export interface LeasedRun {
  readonly runnerId: string;
  readonly runId: string;
  readonly state: string;
  readonly kind: LeasedRunKind;
  readonly teamId: string | null;
  readonly title: string | null;
}

export interface RunnerActivityReaderPort {
  leasedIn(workspaceId: WorkspaceId): Promise<readonly LeasedRun[]>;
}
