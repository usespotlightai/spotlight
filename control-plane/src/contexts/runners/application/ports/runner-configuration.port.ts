import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_CONFIGURATION = Symbol('RUNNER_CONFIGURATION');

export interface RunnerTrustView {
  readonly id: string;
  readonly address: string;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly issuer: string;
  readonly subject: string;
  readonly audience: string;
  readonly labels: readonly string[];
}

export interface RunnerPoolView {
  readonly id: string;
  readonly address: string;
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

export interface EgressView {
  readonly id: string;
  readonly address: string;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly url: string;
  readonly tokenVersion: number | null;
}

export interface WorkspaceRunnersView {
  readonly id: string;
  readonly address: string;
  readonly workspaceId: WorkspaceId;
  readonly trusts: readonly string[];
  readonly pools: readonly string[];
}

export interface RunnersView {
  readonly trusts: readonly RunnerTrustView[];
  readonly pools: readonly RunnerPoolView[];
  readonly egresses: readonly EgressView[];
  readonly declared: WorkspaceRunnersView | null;
}

export interface RunnerConfigurationPort {
  in(workspaceId: WorkspaceId): Promise<RunnersView>;

  trustWithId(id: string): Promise<RunnerTrustView | null>;

  poolWithId(id: string): Promise<RunnerPoolView | null>;

  egressWithId(id: string): Promise<EgressView | null>;

  declaredWithId(id: string): Promise<WorkspaceRunnersView | null>;
}
