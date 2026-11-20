import type {
  PullRequestStatesPort,
  StoredPullRequestState,
  StoredPullRequestStateDto,
} from '@github/application/ports/pull-request-states.port';
import type { PullRequest } from '@github/domain/aggregates/pull-request.aggregate';
import type { PullRequestRepository } from '@github/domain/repositories/pull-request.repository';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const stateOf = (pullRequest: PullRequest): StoredPullRequestState =>
  pullRequest.state === 'open' && pullRequest.draft
    ? 'draft'
    : pullRequest.state;

export class StoredPullRequestStates implements PullRequestStatesPort {
  constructor(private readonly pullRequests: PullRequestRepository) {}

  async of(
    workspaceId: WorkspaceId,
    urls: readonly PullRequestUrl[],
  ): Promise<readonly StoredPullRequestStateDto[]> {
    const found = await Promise.all(
      urls.map(async (url) => {
        const { repository, number } = url;

        if (!repository || number === null) {
          return null;
        }

        const pullRequest = await this.pullRequests.numbered(
          workspaceId,
          repository,
          number,
        );

        return pullRequest
          ? { url: url.value, state: stateOf(pullRequest) }
          : null;
      }),
    );

    return found.filter((each) => each !== null);
  }
}
