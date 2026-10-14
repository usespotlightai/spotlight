import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const REACHABLE_REPOSITORIES = Symbol('REACHABLE_REPOSITORIES');

export interface ReachableRepositoriesPort {
  reaches(workspaceId: WorkspaceId, repository: Repository): Promise<boolean>;
}
