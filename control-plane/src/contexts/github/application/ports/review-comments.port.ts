import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ReviewCommentReply {
  readonly workspaceId: WorkspaceId;
  readonly repository: Repository;
  readonly pullRequest: PullRequestUrl;
  readonly reviewComment: string;
  readonly body: string;
  readonly resolve: boolean;
}

export const REVIEW_COMMENTS = Symbol('REVIEW_COMMENTS');

export interface ReviewCommentsPort {
  reply(reply: ReviewCommentReply): Promise<void>;
}
