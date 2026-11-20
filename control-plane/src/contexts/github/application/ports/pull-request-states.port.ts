import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

type StoredPullRequestState = 'draft' | 'open' | 'merged' | 'closed';

export interface StoredPullRequestStateDto {
  readonly url: string;
  readonly state: StoredPullRequestState;
}

export interface PullRequestStatesPort {
  of(
    workspaceId: WorkspaceId,
    urls: readonly PullRequestUrl[],
  ): Promise<readonly StoredPullRequestStateDto[]>;
}

export const PULL_REQUEST_STATES = Symbol('PULL_REQUEST_STATES');
