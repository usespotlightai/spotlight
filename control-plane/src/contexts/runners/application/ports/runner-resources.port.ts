import type { WaysIn } from '@runners/domain/services/runner-drift';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_RESOURCES = Symbol('RUNNER_RESOURCES');

export interface RunnerTrustRecord {
  readonly id: string;
  readonly version: number;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly issuer: string;
  readonly subject: string;
  readonly audience: string;
  readonly labels: readonly string[];
}

export interface WorkspaceRunnersRecord {
  readonly id: string;
  readonly version: number;
  readonly workspaceId: WorkspaceId;
  readonly trusts: readonly string[];
  readonly pools: readonly string[];
}

export interface RunnerPoolRecord {
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

export interface EgressRecord {
  readonly id: string;
  readonly version: number;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly url: string;
  readonly tokenVersion: number | null;
}

export interface RunnerResourcesPort {
  trustWithId(id: string): Promise<RunnerTrustRecord | null>;

  trustAt(
    workspaceId: WorkspaceId,
    key: string,
  ): Promise<RunnerTrustRecord | null>;

  trustsIn(workspaceId: WorkspaceId): Promise<readonly RunnerTrustRecord[]>;

  poolWithId(id: string): Promise<RunnerPoolRecord | null>;

  poolAt(
    workspaceId: WorkspaceId,
    key: string,
  ): Promise<RunnerPoolRecord | null>;

  poolsIn(workspaceId: WorkspaceId): Promise<readonly RunnerPoolRecord[]>;

  provisioningPools(): Promise<readonly RunnerPoolRecord[]>;

  egressWithId(id: string): Promise<EgressRecord | null>;

  egressAt(workspaceId: WorkspaceId, key: string): Promise<EgressRecord | null>;

  egressesIn(workspaceId: WorkspaceId): Promise<readonly EgressRecord[]>;

  declaredWithId(id: string): Promise<WorkspaceRunnersRecord | null>;

  declaredIn(workspaceId: WorkspaceId): Promise<WorkspaceRunnersRecord | null>;

  waysIn(workspaceId: WorkspaceId): Promise<WaysIn>;
}
