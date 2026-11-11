import type { BotComment } from '@github/domain/value-objects/bot-comment.vo';
import type { DraftPeriod } from '@github/domain/value-objects/draft-period.vo';
import type { PullRequestReview } from '@github/domain/value-objects/pull-request-review.vo';
import type { PullRequestState } from '@github/domain/value-objects/pull-request-state.vo';
import type { PullRequestThread } from '@github/domain/value-objects/pull-request-thread.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface UpdatedPullRequest {
  readonly pullRequest: PullRequestUrl;
  readonly repository: Repository;
  readonly number: number;
  readonly title: string;
  readonly author: string | null;
  readonly authorIsBot: boolean;
  readonly branch: string | null;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly changedFiles: number | null;
  readonly openedAt: Date;
  readonly state: PullRequestState;
  readonly closedAt: Date | null;
  readonly updatedAt: Date;
  readonly readyForReviewAt: Date | null;
  readonly draftPeriods: readonly DraftPeriod[];
  readonly reviews: readonly PullRequestReview[];
  readonly dismissedReviews: readonly number[];
  readonly reviewComments: number;
  readonly botComments: readonly BotComment[];
  readonly threads: readonly PullRequestThread[];
  readonly isRevert: boolean;
  readonly revertedBy: PullRequestUrl | null;
  readonly version: number;
}

export class PullRequestUpdated implements DomainEvent {
  readonly kind = 'pull-request.updated';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly updated: UpdatedPullRequest,
  ) {}
}
