import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PULL_REQUEST_COMMENTS = Symbol('PULL_REQUEST_COMMENTS');

export interface StickyComment {
  readonly workspaceId: WorkspaceId;
  readonly repository: Repository;
  readonly pullRequest: PullRequestUrl;
  readonly marker: string;
  readonly body: string;
}

export type StickyCommentPlace = Omit<StickyComment, 'body'>;

export interface PullRequestCommentsPort {
  upsert(comment: StickyComment): Promise<void>;

  withdraw(place: StickyCommentPlace): Promise<void>;
}
