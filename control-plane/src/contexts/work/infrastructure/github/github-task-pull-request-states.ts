import type { PullRequestStatesPort } from '@github/application/ports/pull-request-states.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskPullRequestState } from '@work/application/dto/task-pull-request.dto';
import type { TaskPullRequestStatesPort } from '@work/application/ports/task-pull-request-states.port';

export class GitHubTaskPullRequestStates implements TaskPullRequestStatesPort {
  constructor(private readonly states: PullRequestStatesPort) {}

  async of(
    workspaceId: WorkspaceId,
    urls: readonly PullRequestUrl[],
  ): Promise<ReadonlyMap<string, TaskPullRequestState>> {
    const found = await this.states.of(workspaceId, urls);

    return new Map(found.map((each) => [each.url, each.state]));
  }
}
