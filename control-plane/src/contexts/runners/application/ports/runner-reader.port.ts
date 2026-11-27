import type { LiveSandboxState } from '@runners/domain/aggregates/sandbox.aggregate';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface PlatformPoolSummary {
  readonly egress: boolean;
}

export type CredentialSourceSummary =
  | {
      readonly kind: 'pool';
      readonly key: string | null;
      // Set when the pool is the platform pool that Spotlight adds to each workspace.
      readonly platform: PlatformPoolSummary | null;
    }
  | { readonly kind: 'trust'; readonly key: string | null };

export interface LiveRunnerSummary {
  readonly id: string;
  readonly source: CredentialSourceSummary;
  readonly hostId: string | null;
  readonly image: string | null;
  readonly harnesses: readonly string[];
  readonly startedAt: Date;
  readonly lastHeartbeatAt: Date | null;
}

export interface IdleSandboxSummary {
  readonly id: string;
  readonly hostId: string;
  readonly key: string | null;
  readonly warmLineId: string | null;
  readonly warmImage: string | null;
  readonly state: LiveSandboxState;
  readonly idleSince: Date;
  readonly startedAt: Date;
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
  readonly reportedSandboxes: readonly string[];
  readonly images: readonly HostImageSummary[];
  readonly firstHeartbeatAt: Date;
  readonly onlineSince: Date;
  readonly lastHeartbeatAt: Date;
}

export const RUNNER_READER = Symbol('RUNNER_READER');

export interface RunnerReaderPort {
  inWorkspace(workspaceId: WorkspaceId): Promise<LiveRunnerSummary[]>;

  hostsIn(workspaceId: WorkspaceId, since: Date): Promise<HostSummary[]>;

  idleSandboxesOn(hostIds: readonly string[]): Promise<IdleSandboxSummary[]>;

  supportedModels(
    workspaceId: WorkspaceId,
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
