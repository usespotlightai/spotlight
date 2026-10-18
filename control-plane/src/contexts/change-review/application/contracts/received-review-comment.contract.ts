import type { ReviewSide } from '@change-review/domain/value-objects/review-anchor.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

type ReceivedPlace =
  | { readonly subject: 'file' }
  | {
      readonly subject: 'line';
      readonly side: ReviewSide;
      readonly line: number | null;
      readonly startLine: number | null;
    };

export interface ReceivedReviewComment {
  readonly workspaceId: WorkspaceId;
  readonly action: 'created' | 'edited' | 'deleted';
  readonly pullRequest: string;
  readonly comment: {
    readonly id: number;
    readonly url: string;
    readonly path: string;
    readonly body: string;
    readonly inReplyToId: number | null;
    readonly login: string | null;
    readonly writtenAt: Date | null;
  } & ReceivedPlace;
}
