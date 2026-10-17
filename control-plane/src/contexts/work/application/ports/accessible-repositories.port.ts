import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const ACCESSIBLE_REPOSITORIES = Symbol('ACCESSIBLE_REPOSITORIES');

export interface AccessibleRepositoriesPort {
  isAccessible(
    workspaceId: WorkspaceId,
    repository: Repository,
  ): Promise<boolean>;
}
