export type PullRequestActivityKind =
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

export interface PullRequestActivity {
  readonly activity: PullRequestActivityKind;
  readonly branch: string | null;
  readonly pullRequest: string | null;
  readonly remark: PullRequestRemark | null;
  readonly byBot: boolean;
}
