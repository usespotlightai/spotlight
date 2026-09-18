export const REVIEW_COMMENT_STATE_NAMES = [
  'draft',
  'sending',
  'posted',
  'failed',
] as const;

export const REVIEW_SIDE_NAMES = ['new', 'old'] as const;

export const REVIEW_VERDICT_NAMES = [
  'comment',
  'approve',
  'request-changes',
] as const;

export interface ReviewCommentDto {
  readonly id: string;
  readonly path: string;
  readonly side: (typeof REVIEW_SIDE_NAMES)[number];
  readonly line: number;
  readonly startLine: number | null;
  readonly body: string;
  readonly authorName: string;
  readonly authorLogin: string | null;
  readonly authorImage: string | null;
  readonly yours: boolean;
  readonly byAgent: boolean;
  readonly replyTo: string | null;
  readonly state: (typeof REVIEW_COMMENT_STATE_NAMES)[number];
  readonly failure: string | null;
  readonly url: string | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

export interface ReviewDto {
  readonly id: string;
  readonly authorName: string;
  readonly yours: boolean;
  readonly byAgent: boolean;
  readonly verdict: (typeof REVIEW_VERDICT_NAMES)[number];
  readonly body: string;
  readonly state: (typeof REVIEW_COMMENT_STATE_NAMES)[number];
  readonly failure: string | null;
  readonly submittedAt: string;
}

export interface RunReviewDto {
  readonly pullRequest: string | null;
  readonly comments: readonly ReviewCommentDto[];
  readonly reviews: readonly ReviewDto[];
}
