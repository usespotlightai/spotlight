import type { BotActivity } from '@github/domain/value-objects/bot-activity.vo';
import type { DraftPeriod } from '@github/domain/value-objects/draft-period.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type UpdatedState = 'open' | 'merged' | 'closed';

export interface UpdatedPullRequest {
  readonly pullRequest: string;
  readonly repository: string;
  readonly number: number;
  readonly title: string;
  readonly author: string | null;
  readonly authorIsBot: boolean;
  readonly branch: string | null;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly changedFiles: number | null;
  readonly openedAt: Date;
  readonly state: UpdatedState;
  readonly closedAt: Date | null;
  readonly updatedAt: Date;
  readonly readyForReviewAt: Date | null;
  readonly draftPeriods: readonly DraftPeriod[];
  readonly firstReviewAt: Date | null;
  readonly firstUnblockingReviewAt: Date | null;
  readonly firstApprovedAt: Date | null;
  readonly humanReviewedAt: readonly Date[];
  readonly reviews: number;
  readonly reviewRounds: number;
  readonly reviewComments: number;
  readonly botActivity: readonly BotActivity[];
  readonly isRevert: boolean;
  readonly revertedBy: string | null;
  readonly version: number;
}

export class PullRequestUpdated implements DomainEvent {
  readonly kind = 'pull-request.updated';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly updated: UpdatedPullRequest,
  ) {}
}
