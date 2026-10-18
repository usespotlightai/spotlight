export const REVIEW_COMMENT_RECEIVED = 'github.review-comment-received.v1';

export type ReviewCommentReceivedIntegrationEvent = {
  readonly kind: typeof REVIEW_COMMENT_RECEIVED;
  readonly workspaceId: string;
  readonly action: 'created' | 'edited' | 'deleted';
  readonly pullRequest: string;
  readonly commentId: number;
  readonly url: string;
  readonly path: string;
  readonly body: string;
  readonly inReplyToId: number | null;
  readonly login: string | null;
  readonly writtenAt: string | null;
} & (
  | { readonly subject: 'file' }
  | {
      readonly subject: 'line';
      readonly side: 'old' | 'new';
      readonly line: number | null;
      readonly startLine: number | null;
    }
);
