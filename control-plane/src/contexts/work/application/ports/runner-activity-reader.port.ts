import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  RUN_SUBJECT_KINDS,
  type RunSubjectKind,
} from '@work/domain/value-objects/run-subject.vo';

export const HELD_RUN_KINDS = [...RUN_SUBJECT_KINDS, 'spec'] as const;

export type HeldRunKind = RunSubjectKind | 'spec';

export const RUNNER_ACTIVITY_READER = Symbol('RUNNER_ACTIVITY_READER');

export interface HeldRun {
  readonly runnerId: string;
  readonly runId: string;
  readonly state: string;
  readonly kind: HeldRunKind;
  readonly teamId: string | null;
  readonly title: string | null;
}

export interface RunnerActivityReaderPort {
  heldIn(workspaceId: WorkspaceId): Promise<readonly HeldRun[]>;
}
