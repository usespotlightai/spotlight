import type { ResourceCreated } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface WorkspaceTokenResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description: string;
  readonly scopes: readonly string[];
  readonly issuedBy: string;
  readonly issuedAt: string;
  readonly expiresAt: string | null;
  readonly warnings: readonly ConfigurationProblem[];
}

export interface WorkspaceTokenCreatedDto {
  readonly created: ResourceCreated;
  readonly token: string | null;
}
