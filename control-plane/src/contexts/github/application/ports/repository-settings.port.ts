import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface DefaultBranchDto {
  readonly name: string;
  readonly protected: boolean;
  readonly repositoryId: string;
  readonly ownerId: string;
}

export type VariablesWrite = 'written' | 'not-permitted';

export const REPOSITORY_SETTINGS = Symbol('REPOSITORY_SETTINGS');

export interface RepositorySettingsPort {
  defaultBranchOf(
    workspaceId: WorkspaceId,
    repository: Repository,
  ): Promise<DefaultBranchDto>;

  oidcSubjectPrefixOf(
    workspaceId: WorkspaceId,
    repository: Repository,
  ): Promise<string>;

  putVariables(
    workspaceId: WorkspaceId,
    repository: Repository,
    variables: Readonly<Record<string, string>>,
  ): Promise<VariablesWrite>;
}
