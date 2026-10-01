import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type RecordedState = 'open' | 'merged' | 'closed';

export interface RecordedPullRequest {
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
  readonly state: RecordedState;
  readonly closedAt: Date | null;
  readonly updatedAt: Date;
  readonly firstReviewAt: Date | null;
  readonly reviews: number;
  readonly reviewRounds: number;
  readonly reviewComments: number;
  readonly isRevert: boolean;
  readonly revertedBy: string | null;
  readonly version: number;
}

export class PullRequestRecorded implements DomainEvent {
  readonly kind = 'pull-request.recorded';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly recorded: RecordedPullRequest,
  ) {}
}
