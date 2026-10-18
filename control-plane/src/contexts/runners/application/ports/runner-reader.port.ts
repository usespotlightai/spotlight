import type { CredentialSourceKind } from '@runners/application/ports/runner-authenticator.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface CredentialSourceSummary {
  readonly kind: CredentialSourceKind;
  readonly key: string | null;
}

export interface LiveRunnerSummary {
  readonly id: string;
  readonly source: CredentialSourceSummary;
  readonly hostId: string | null;
  readonly image: string | null;
  readonly harnesses: readonly string[];
  readonly startedAt: Date;
  readonly lastHeartbeatAt: Date | null;
}

interface HostHarnessSummary {
  readonly id: string;
  readonly version: string | null;
}

interface HostImageSummary {
  readonly image: string;
  readonly digest: string | null;
  readonly isDefault: boolean;
  readonly release: string | null;
  readonly harnesses: readonly HostHarnessSummary[];
  readonly unavailableReason: string | null;
}

export interface HostSummary {
  readonly id: string;
  readonly name: string;
  readonly source: CredentialSourceSummary;
  readonly release: string;
  readonly containerRuntime: string;
  readonly capacity: number;
  readonly running: readonly string[];
  readonly images: readonly HostImageSummary[];
  readonly firstHeartbeatAt: Date;
  readonly onlineSince: Date;
  readonly lastHeartbeatAt: Date;
}

export const RUNNER_READER = Symbol('RUNNER_READER');

export interface RunnerReaderPort {
  inWorkspace(workspaceId: WorkspaceId): Promise<LiveRunnerSummary[]>;

  hostsIn(workspaceId: WorkspaceId, since: Date): Promise<HostSummary[]>;

  readyToRun(workspaceId: WorkspaceId): Promise<boolean>;

  hasEgressCapableRunner(workspaceId: WorkspaceId): Promise<boolean>;

  supportedModels(
    workspaceId: WorkspaceId,
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
