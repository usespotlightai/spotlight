export const PULL_REQUEST_UPDATED = 'github.pull-request-updated.v1';

export type PullRequestUpdatedIntegrationEvent = {
  readonly kind: typeof PULL_REQUEST_UPDATED;
  readonly workspaceId: string;
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
  readonly openedAt: string;
  readonly state: 'open' | 'merged' | 'closed';
  readonly closedAt: string | null;
  readonly updatedAt: string;
  readonly readyForReviewAt: string | null;
  readonly draftPeriods: readonly {
    readonly from: string;
    readonly to: string | null;
  }[];
  readonly firstReviewAt: string | null;
  readonly firstUnblockingReviewAt: string | null;
  readonly firstApprovedAt: string | null;
  readonly humanReviewedAt: readonly string[];
  readonly reviews: number;
  readonly reviewRounds: number;
  readonly reviewComments: number;
  readonly botActivity: readonly {
    readonly login: string;
    readonly reviews: number;
    readonly comments: number;
    readonly threads: number;
    readonly resolvedThreads: number;
  }[];
  readonly isRevert: boolean;
  readonly revertedBy: string | null;
  readonly version: number;
};
