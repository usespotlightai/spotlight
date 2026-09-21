export const REVIEW_COMMENT_RECEIVED = 'github.review-comment-received.v1';

export type ReviewCommentReceivedIntegrationEvent = {
  readonly kind: typeof REVIEW_COMMENT_RECEIVED;
  readonly workspaceId: string;
  readonly action: 'created' | 'edited' | 'deleted';
  readonly pullRequest: string;
  readonly commentId: number;
  readonly url: string;
  readonly path: string;
  readonly side: 'old' | 'new';
  readonly line: number | null;
  readonly startLine: number | null;
  readonly body: string;
  readonly answers: number | null;
  readonly login: string | null;
  readonly writtenAt: string | null;
};
