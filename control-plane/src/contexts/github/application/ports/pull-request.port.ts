import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface OpenedPullRequestDto {
  readonly url: string;
}

export interface PullRequestOpening {
  readonly workspaceId: WorkspaceId;
  readonly repository: Repository;
  readonly branch: string;
  readonly title: string;
  readonly body: string;
}

export const PULL_REQUESTS = Symbol('PULL_REQUESTS');

export interface PullRequestPort {
  open(opening: PullRequestOpening): Promise<OpenedPullRequestDto>;
}
