import type { PullRequestSummariesPort } from '@github/application/ports/pull-request-summaries.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskPullRequestSummary } from '@work/application/dto/task-pull-request.dto';
import type { TaskPullRequestSummariesPort } from '@work/application/ports/task-pull-request-summaries.port';

export class GitHubTaskPullRequestSummaries implements TaskPullRequestSummariesPort {
  constructor(private readonly summaries: PullRequestSummariesPort) {}

  async of(
    workspaceId: WorkspaceId,
    urls: readonly PullRequestUrl[],
  ): Promise<ReadonlyMap<string, TaskPullRequestSummary>> {
    const found = await this.summaries.of(workspaceId, urls);

    return new Map(found.map(({ url, ...summary }) => [url, summary]));
  }
}
