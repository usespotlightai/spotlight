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
  readonly reviews: readonly {
    readonly id: number;
    readonly state: 'approved' | 'changes-requested' | 'commented';
    readonly login: string | null;
    readonly byBot: boolean;
    readonly submittedAt: string | null;
    readonly dismissed: boolean;
  }[];
  readonly reviewComments: number;
  readonly botComments: readonly {
    readonly id: number;
    readonly on: 'line' | 'conversation';
    readonly login: string;
    readonly opensThread: boolean;
    readonly deleted: boolean;
  }[];
  readonly threads: readonly {
    readonly id: string;
    readonly firstCommentId: number | null;
    readonly login: string | null;
    readonly byBot: boolean;
    readonly resolved: boolean;
  }[];
  readonly isRevert: boolean;
  readonly revertedBy: string | null;
  readonly version: number;
};
