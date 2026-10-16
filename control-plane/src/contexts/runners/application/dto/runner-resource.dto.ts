import type { ResourceCreated } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

interface ResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly workspaceId: string;
  readonly warnings: readonly ConfigurationProblem[];
}

export interface RunnerTrustResourceDto extends ResourceDto {
  readonly key: string;
  readonly issuer: string;
  readonly subject: string;
  readonly audience: string;
  readonly labels: readonly string[];
}

export interface RunnerPoolResourceDto extends ResourceDto {
  readonly key: string;
  readonly labels: readonly string[];
  readonly maxRuns: number | null;
  readonly mode: 'pull' | 'push';
  readonly tokenVersion: number | null;
  readonly provision: {
    readonly url: string;
    readonly secretVersion: number | null;
    readonly egress: string | null;
    readonly egressTraffic: 'all' | 'bound';
  } | null;
}

export interface EgressResourceDto extends ResourceDto {
  readonly key: string;
  readonly url: string;
  readonly tokenVersion: number | null;
}

export interface WorkspaceRunnersResourceDto extends ResourceDto {
  readonly trusts: readonly string[];
  readonly pools: readonly string[];
}

export interface RunnerPoolCreatedDto {
  readonly created: ResourceCreated;
  readonly token: string | null;
}

export interface EgressCreatedDto {
  readonly created: ResourceCreated;
  readonly token: string | null;
}
