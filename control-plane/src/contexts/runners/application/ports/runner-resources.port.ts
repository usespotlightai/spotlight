import type { WaysIn } from '@runners/domain/services/runner-drift';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_RESOURCES = Symbol('RUNNER_RESOURCES');

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
  readonly trusts: readonly string[];
  readonly pools: readonly string[];
}

export interface KeptPool {
  readonly id: string;
  readonly version: number;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly labels: readonly string[];
  readonly maxRuns: number | null;
  readonly tokenVersion: number | null;
  readonly provision: {
    readonly url: string;
    readonly secretVersion: number | null;
    readonly egress: string | null;
    readonly egressTraffic: 'all' | 'bound';
  } | null;
}

export interface KeptEgress {
  readonly id: string;
  readonly version: number;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly url: string;
  readonly tokenVersion: number | null;
}

export interface RunnerResourcesPort {
  trustWithId(id: string): Promise<KeptTrust | null>;

  trustAt(workspaceId: WorkspaceId, key: string): Promise<KeptTrust | null>;

  trustsIn(workspaceId: WorkspaceId): Promise<readonly KeptTrust[]>;

  poolWithId(id: string): Promise<KeptPool | null>;

  poolAt(workspaceId: WorkspaceId, key: string): Promise<KeptPool | null>;

  poolsIn(workspaceId: WorkspaceId): Promise<readonly KeptPool[]>;

  provisioningPools(): Promise<readonly KeptPool[]>;

  egressWithId(id: string): Promise<KeptEgress | null>;

  egressAt(workspaceId: WorkspaceId, key: string): Promise<KeptEgress | null>;

  egressesIn(workspaceId: WorkspaceId): Promise<readonly KeptEgress[]>;

  declaredWithId(id: string): Promise<KeptWorkspaceRunners | null>;

  declaredIn(workspaceId: WorkspaceId): Promise<KeptWorkspaceRunners | null>;

  waysIn(workspaceId: WorkspaceId): Promise<WaysIn>;
}
