import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ForgottenPort {
  forgetTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void>;

  forgetTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  forgetWorkspace(workspaceId: WorkspaceId): Promise<void>;

  holding(
    workspaceId: WorkspaceId,
    taskId: TaskId | null,
    teamId?: TeamId | null,
  ): Promise<void>;

  forgot(
    workspaceId: WorkspaceId,
    taskId: TaskId | null,
    teamId?: TeamId | null,
  ): Promise<boolean>;
}
