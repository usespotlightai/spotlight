export const PULL_REQUEST_REVIEWED = 'github.pull-request-reviewed.v1';

type PullRequestReviewState = 'approved' | 'changes-requested' | 'commented';

export type PullRequestReviewedIntegrationEvent = {
  readonly kind: typeof PULL_REQUEST_REVIEWED;
  readonly workspaceId: string;
  readonly pullRequest: string;
  readonly state: PullRequestReviewState;
  readonly login: string | null;
  readonly byBot: boolean;
  readonly submittedAt: string | null;
};
