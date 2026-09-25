import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_CONFIGURATION = Symbol('RUNNER_CONFIGURATION');

export interface ConfiguredRunner {
  readonly id: string;
  readonly address: string;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly labels: readonly string[];
}

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
  } | null;
}

export interface ConfiguredWorkspaceRunners {
  readonly id: string;
  readonly address: string;
  readonly workspaceId: WorkspaceId;
  readonly runners: readonly string[];
  readonly trusts: readonly string[];
  readonly pools: readonly string[];
}

export interface ConfiguredRunners {
  readonly runners: readonly ConfiguredRunner[];
  readonly trusts: readonly ConfiguredRunnerTrust[];
  readonly pools: readonly ConfiguredRunnerPool[];
  readonly declared: ConfiguredWorkspaceRunners | null;
}

export interface RunnerConfigurationPort {
  in(workspaceId: WorkspaceId): Promise<ConfiguredRunners>;

  runnerWithId(id: string): Promise<ConfiguredRunner | null>;

  trustWithId(id: string): Promise<ConfiguredRunnerTrust | null>;

  poolWithId(id: string): Promise<ConfiguredRunnerPool | null>;

  declaredWithId(id: string): Promise<ConfiguredWorkspaceRunners | null>;
}
