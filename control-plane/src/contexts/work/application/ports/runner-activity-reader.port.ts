import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_ACTIVITY_READER = Symbol('RUNNER_ACTIVITY_READER');

export interface HeldRun {
  readonly runnerId: string;
  readonly runId: string;
  readonly state: string;
}

export interface RunnerActivityReaderPort {
  heldIn(workspaceId: WorkspaceId): Promise<readonly HeldRun[]>;
}
