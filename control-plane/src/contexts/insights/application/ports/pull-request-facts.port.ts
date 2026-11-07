import type { PullRequestFact } from '@insights/domain/services/team-pull-requests';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PullRequestFactsPort {
  put(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
    fact: PullRequestFact,
  ): Promise<void>;

  drop(workspaceId: WorkspaceId, pullRequest: PullRequestUrl): Promise<void>;
}
