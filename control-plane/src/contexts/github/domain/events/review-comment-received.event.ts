import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

type CommentPlace =
  | { readonly subject: 'file' }
  | {
      readonly subject: 'line';
      readonly side: 'old' | 'new';
      readonly line: number | null;
      readonly startLine: number | null;
    };

export type ReceivedComment = {
  readonly id: number;
  readonly url: string;
  readonly path: string;
  readonly body: string;
  readonly inReplyToId: number | null;
  readonly login: string | null;
  readonly writtenAt: Date | null;
} & CommentPlace;

export class ReviewCommentReceived implements DomainEvent {
  readonly kind = 'pull-request.review-comment-received';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly action: 'created' | 'edited' | 'deleted',
    readonly pullRequest: string,
    readonly comment: ReceivedComment,
  ) {}
}
