import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import type { TeamWindow } from '@outcomes/domain/repositories/run-record.repository';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TaskDeliveryRepository {
  add(delivery: TaskDelivery): Promise<void>;

  save(delivery: TaskDelivery): Promise<void>;

  forTask(taskId: TaskId): Promise<TaskDelivery | null>;

  forTasks(taskIds: readonly TaskId[]): Promise<readonly TaskDelivery[]>;

  ofTeamBetween(
    window: TeamWindow,
    most: number,
  ): Promise<readonly TaskDelivery[]>;

  ofTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<readonly TaskDelivery[]>;

  forPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskDelivery | null>;

  removeForTask(taskId: TaskId): Promise<void>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
