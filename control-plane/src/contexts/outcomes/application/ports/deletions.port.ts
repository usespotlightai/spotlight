import type { PullRequestTombstone } from '@outcomes/domain/services/pull-request-tombstone';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface DeletionsPort {
  deleteTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void>;

  deleteTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  deleteWorkspace(workspaceId: WorkspaceId): Promise<void>;

  lockDeletion(
    workspaceId: WorkspaceId,
    taskId: TaskId | null,
    teamId?: TeamId | null,
  ): Promise<void>;

  isDeleted(
    workspaceId: WorkspaceId,
    taskId: TaskId | null,
    teamId?: TeamId | null,
  ): Promise<boolean>;

  lockPullRequestDeletion(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<void>;

  deletePullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
    tombstone: PullRequestTombstone,
  ): Promise<void>;

  tombstoneOf(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<PullRequestTombstone | null>;

  purgeTombstonesBefore(before: Date, max: number): Promise<number>;
}
