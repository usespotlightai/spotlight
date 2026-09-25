import type { AdmissionKind } from '@runners/domain/value-objects/admission.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface AdmittedThrough {
  readonly kind: AdmissionKind;
  readonly key: string | null;
}

export interface LiveRunnerSummary {
  readonly id: string;
  readonly through: AdmittedThrough;
  readonly hostId: string | null;
  readonly harnesses: readonly string[];
  readonly startedAt: Date;
  readonly lastSeenAt: Date | null;
}

export interface HostSummary {
  readonly id: string;
  readonly name: string;
  readonly through: AdmittedThrough;
  readonly release: string;
  readonly executor: string;
  readonly capacity: number;
  readonly running: readonly string[];
  readonly harnesses: readonly string[];
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
}

export const RUNNER_READER = Symbol('RUNNER_READER');

export interface RunnerReaderPort {
  inWorkspace(workspaceId: WorkspaceId): Promise<LiveRunnerSummary[]>;

  hostsIn(workspaceId: WorkspaceId, since: Date): Promise<HostSummary[]>;

  anyOffersWork(workspaceId: WorkspaceId): Promise<boolean>;

  advertisedModels(
    workspaceId: WorkspaceId,
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
