import type { RepositoryVisibility } from '@github/domain/value-objects/repository-visibility.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const REPOSITORY_VISIBILITY = Symbol('REPOSITORY_VISIBILITY');

export interface RepositoryVisibilityPort {
  arePublic(
    workspaceId: WorkspaceId,
    repositories: readonly Repository[],
  ): Promise<boolean>;
}

export interface RecordsRepositoryVisibility {
  record(
    repository: Repository,
    visibility: RepositoryVisibility,
  ): Promise<void>;
}
