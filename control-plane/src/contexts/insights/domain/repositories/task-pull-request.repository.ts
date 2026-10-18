import type { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TaskPullRequestRepository {
  add(taskPullRequest: TaskPullRequest): Promise<void>;

  save(taskPullRequest: TaskPullRequest): Promise<void>;

  forTask(taskId: TaskId): Promise<TaskPullRequest | null>;

  forTasks(taskIds: readonly TaskId[]): Promise<readonly TaskPullRequest[]>;

  ofTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<readonly TaskPullRequest[]>;

  forPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskPullRequest | null>;

  removeForTask(taskId: TaskId): Promise<void>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
