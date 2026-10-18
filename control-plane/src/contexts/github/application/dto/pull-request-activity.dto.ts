export type PullRequestActivityKind =
  | 'opened'
  | 'labelled'
  | 'merged'
  | 'closed-unmerged'
  | 'commented'
  | 'changes-requested'
  | 'checks-failed';

export interface PullRequestReviewComment {
  readonly body: string;
  readonly path: string | null;
  readonly from: number | null;
  readonly to: number | null;
  readonly id: string | null;
}

export interface PullRequestDetails {
  readonly title: string;
  readonly body: string | null;
  readonly author: string | null;
  readonly authorAssociation: string | null;
  readonly draft: boolean;
}

export interface PullRequestActivity {
  readonly activity: PullRequestActivityKind;
  readonly branch: string | null;
  readonly pullRequest: string | null;
  readonly label: string | null;
  readonly details: PullRequestDetails | null;
  readonly reviewComment: PullRequestReviewComment | null;
  readonly byBot: boolean;
}
