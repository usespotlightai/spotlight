import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskPullRequestState } from '@work/application/dto/task-pull-request.dto';

export interface TaskPullRequestStatesPort {
  of(
    workspaceId: WorkspaceId,
    urls: readonly PullRequestUrl[],
  ): Promise<ReadonlyMap<string, TaskPullRequestState>>;
}

export const TASK_PULL_REQUEST_STATES = Symbol('TASK_PULL_REQUEST_STATES');
