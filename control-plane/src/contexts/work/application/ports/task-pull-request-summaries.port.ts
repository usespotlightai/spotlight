import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskPullRequestSummary } from '@work/application/dto/task-pull-request.dto';

export interface TaskPullRequestSummariesPort {
  of(
    workspaceId: WorkspaceId,
    urls: readonly PullRequestUrl[],
  ): Promise<ReadonlyMap<string, TaskPullRequestSummary>>;
}

export const TASK_PULL_REQUEST_SUMMARIES = Symbol(
  'TASK_PULL_REQUEST_SUMMARIES',
);
