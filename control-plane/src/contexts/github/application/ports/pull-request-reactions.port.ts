import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PULL_REQUEST_REACTIONS = Symbol('PULL_REQUEST_REACTIONS');

export type PullRequestReaction = 'eyes';

export interface ReactedTo {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
}

export interface PullRequestReactionsPort {
  react(on: ReactedTo, reaction: PullRequestReaction): Promise<void>;

  remove(on: ReactedTo, reaction: PullRequestReaction): Promise<void>;
}
