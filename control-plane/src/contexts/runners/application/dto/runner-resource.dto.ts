import type { ResourceCreated } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

interface ResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly workspaceId: string;
  readonly warnings: readonly ConfigurationProblem[];
}

export interface RunnerResourceDto extends ResourceDto {
  readonly name: string;
  readonly labels: readonly string[];
  readonly trust: string | null;
}

export interface RunnerTrustResourceDto extends ResourceDto {
  readonly key: string;
  readonly issuer: string;
  readonly subject: string;
  readonly audience: string;
  readonly labels: readonly string[];
}

export interface WorkspaceRunnersResourceDto extends ResourceDto {
  readonly runners: readonly string[];
  readonly trusts: readonly string[];
  readonly drift: readonly string[];
}

export interface RunnerCreatedDto {
  readonly created: ResourceCreated;
  readonly token: string | null;
}
