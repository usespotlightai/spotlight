import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ConflictingPullRequestDto {
  readonly url: string;
  readonly branch: string | null;
}

export const PULL_REQUEST_CONFLICTS = Symbol('PULL_REQUEST_CONFLICTS');

export interface PullRequestConflictsPort {
  conflictingWith(
    workspaceId: WorkspaceId,
    repository: Repository,
    base: string,
  ): Promise<readonly ConflictingPullRequestDto[]>;
}
