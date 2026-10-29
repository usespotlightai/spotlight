import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface OpenedPullRequestDto {
  readonly url: string;
  readonly number: number;
  readonly id: number;
  readonly repository: string;
}

export interface PullRequestStatusDto {
  readonly state: 'open' | 'closed' | 'merged';
  readonly closedAt: Date | null;
}

export interface PullRequestAt {
  readonly workspaceId: WorkspaceId;
  readonly repository: Repository;
  readonly number: number;
}

export interface PullRequestOpening {
  readonly workspaceId: WorkspaceId;
  readonly repository: Repository;
  readonly branch: string;
  readonly title: string;
  readonly body: string;
}

export interface PullRequestEditing {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly title: string;
  readonly body: string | null;
}

export const PULL_REQUESTS = Symbol('PULL_REQUESTS');

export interface PullRequestPort {
  open(opening: PullRequestOpening): Promise<OpenedPullRequestDto>;

  edit(editing: PullRequestEditing): Promise<void>;

  statusOf(at: PullRequestAt): Promise<PullRequestStatusDto>;

  close(at: PullRequestAt): Promise<void>;

  comment(at: PullRequestAt, body: string): Promise<void>;

  changedOn(
    workspaceId: WorkspaceId,
    repository: Repository,
    branch: string,
  ): Promise<readonly string[]>;

  changedIn(
    workspaceId: WorkspaceId,
    repository: Repository,
    pullRequest: PullRequestUrl,
  ): Promise<readonly string[]>;
}
