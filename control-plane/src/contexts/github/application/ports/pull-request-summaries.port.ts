import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

type StoredPullRequestState = 'draft' | 'open' | 'merged' | 'closed';

export interface PullRequestSummaryDto {
  readonly url: string;
  readonly state: StoredPullRequestState;
  readonly title: string;
  readonly author: string | null;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly changedFiles: number | null;
  readonly updatedAt: Date;
}

export interface PullRequestSummariesPort {
  of(
    workspaceId: WorkspaceId,
    urls: readonly PullRequestUrl[],
  ): Promise<readonly PullRequestSummaryDto[]>;
}

export const PULL_REQUEST_SUMMARIES = Symbol('PULL_REQUEST_SUMMARIES');
