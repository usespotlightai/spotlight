import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_CONFIGURATION = Symbol('RUNNER_CONFIGURATION');

export interface ConfiguredRunnerTrust {
  readonly id: string;
  readonly address: string;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly issuer: string;
  readonly subject: string;
  readonly audience: string;
  readonly labels: readonly string[];
}

export interface ConfiguredRunnerPool {
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

export interface ConfiguredEgress {
  readonly id: string;
  readonly address: string;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly url: string;
  readonly tokenVersion: number | null;
}

export interface ConfiguredWorkspaceRunners {
  readonly id: string;
  readonly address: string;
  readonly workspaceId: WorkspaceId;
  readonly trusts: readonly string[];
  readonly pools: readonly string[];
}

export interface ConfiguredRunners {
  readonly trusts: readonly ConfiguredRunnerTrust[];
  readonly pools: readonly ConfiguredRunnerPool[];
  readonly egresses: readonly ConfiguredEgress[];
  readonly declared: ConfiguredWorkspaceRunners | null;
}

export interface RunnerConfigurationPort {
  in(workspaceId: WorkspaceId): Promise<ConfiguredRunners>;

  trustWithId(id: string): Promise<ConfiguredRunnerTrust | null>;

  poolWithId(id: string): Promise<ConfiguredRunnerPool | null>;

  egressWithId(id: string): Promise<ConfiguredEgress | null>;

  declaredWithId(id: string): Promise<ConfiguredWorkspaceRunners | null>;
}
