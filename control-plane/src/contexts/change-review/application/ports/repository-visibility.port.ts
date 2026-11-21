import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const REPOSITORY_VISIBILITY = Symbol(
  'CHANGE_REVIEW_REPOSITORY_VISIBILITY',
);

export interface RepositoryVisibilityPort {
  arePublic(
    workspaceId: WorkspaceId,
    repositories: readonly Repository[],
  ): Promise<boolean>;
}
