import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PullRequestMerge {
  readonly commit: string;
}

const COMMIT = /^[0-9a-f]{40}$/i;

export type ReportedMerge =
  | { readonly outcome: 'unmerged' }
  | { readonly outcome: 'merged'; readonly merge: PullRequestMerge }
  | { readonly outcome: 'unproven' };

export const mergeOf = (
  merged: boolean,
  commit: string | null,
): ReportedMerge => {
  if (!merged) {
    return { outcome: 'unmerged' };
  }

  return commit && COMMIT.test(commit)
    ? { outcome: 'merged', merge: { commit } }
    : { outcome: 'unproven' };
};

export class PullRequestClosed implements DomainEvent {
  readonly kind = 'pull-request.closed';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: PullRequestUrl,
    readonly repository: Repository,
    readonly gitHubId: number | null,
    readonly merge: PullRequestMerge | null,
    readonly closedAt: Date | null,
  ) {}
}
