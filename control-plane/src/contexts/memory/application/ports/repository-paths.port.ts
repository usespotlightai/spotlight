import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const REPOSITORY_PATHS = Symbol('MEMORY_REPOSITORY_PATHS');

export interface RepositoryPathsPort {
  pathsAt(
    workspaceId: WorkspaceId,
    repository: Repository,
  ): Promise<ReadonlySet<string> | null>;
}
