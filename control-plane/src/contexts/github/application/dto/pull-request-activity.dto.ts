export type PullRequestActivityKind =
  | 'opened'
  | 'merged'
  | 'closed-unmerged'
  | 'commented'
  | 'changes-requested'
  | 'checks-failed';

export interface PullRequestRemark {
  readonly body: string;
  readonly path: string | null;
  readonly from: number | null;
  readonly to: number | null;
  readonly id: string | null;
}

export interface PullRequestAbout {
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
  readonly about: PullRequestAbout | null;
  readonly remark: PullRequestRemark | null;
  readonly byBot: boolean;
}
