import type { Enrolment } from '@runners/domain/services/runner-drift';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_RESOURCES = Symbol('RUNNER_RESOURCES');

export interface KeptRunner {
  readonly id: string;
  readonly revision: number;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly labels: readonly string[];
  readonly trustKey: string | null;
}

export interface KeptTrust {
  readonly id: string;
  readonly version: number;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly issuer: string;
  readonly subject: string;
  readonly audience: string;
  readonly labels: readonly string[];
}

export interface KeptWorkspaceRunners {
  readonly id: string;
  readonly version: number;
  readonly workspaceId: WorkspaceId;
  readonly runners: readonly string[];
  readonly trusts: readonly string[];
}

export interface RunnerResourcesPort {
  runnerWithId(id: string): Promise<KeptRunner | null>;

  runnerNamed(
    workspaceId: WorkspaceId,
    name: string,
  ): Promise<KeptRunner | null>;

  trustWithId(id: string): Promise<KeptTrust | null>;

  trustAt(workspaceId: WorkspaceId, key: string): Promise<KeptTrust | null>;

  declaredWithId(id: string): Promise<KeptWorkspaceRunners | null>;

  declaredIn(workspaceId: WorkspaceId): Promise<KeptWorkspaceRunners | null>;

  enrolmentIn(workspaceId: WorkspaceId): Promise<Enrolment>;
}
