import type { DeliveryFailureCode } from '@change-review/domain/value-objects/delivery-failure.vo';

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

export const PULL_REQUEST_ROUTE_NAMES = [
  'routed',
  'waiting',
  'ambiguous',
] as const;

export interface DeliveryFailureDto {
  readonly code: DeliveryFailureCode;
  readonly detail: string | null;
}

export interface ReviewCommentDto {
  readonly id: string;
  readonly repository: string | null;
  readonly path: string;
  readonly side: (typeof REVIEW_SIDE_NAMES)[number] | null;
  readonly line: number | null;
  readonly startLine: number | null;
  readonly body: string;
  readonly authorName: string;
  readonly authorLogin: string | null;
  readonly authorImage: string | null;
  readonly viewerIsAuthor: boolean;
  readonly isAgentAuthored: boolean;
  readonly replyTo: string | null;
  readonly state: (typeof REVIEW_COMMENT_STATE_NAMES)[number];
  readonly failure: DeliveryFailureDto | null;
  readonly url: string | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

export interface ReviewDto {
  readonly id: string;
  readonly repository: string | null;
  readonly authorName: string;
  readonly viewerIsAuthor: boolean;
  readonly isAgentAuthored: boolean;
  readonly verdict: (typeof REVIEW_VERDICT_NAMES)[number];
  readonly body: string;
  readonly state: (typeof REVIEW_COMMENT_STATE_NAMES)[number];
  readonly failure: DeliveryFailureDto | null;
  readonly submittedAt: string;
}

interface PullRequestLandingDto {
  readonly repository: string | null;
  readonly route: (typeof PULL_REQUEST_ROUTE_NAMES)[number];
  readonly pullRequest: string | null;
}

export interface RunReviewDto {
  readonly landings: readonly PullRequestLandingDto[];
  readonly comments: readonly ReviewCommentDto[];
  readonly reviews: readonly ReviewDto[];
}
