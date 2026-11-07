import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type DeletionScope =
  | {
      readonly kind: 'task';
      readonly workspaceId: WorkspaceId;
      readonly taskId: TaskId;
    }
  | {
      readonly kind: 'team';
      readonly workspaceId: WorkspaceId;
      readonly teamId: TeamId;
    }
  | { readonly kind: 'workspace'; readonly workspaceId: WorkspaceId };

export const DeletionScope = {
  ofTask: (workspaceId: WorkspaceId, taskId: TaskId): DeletionScope => ({
    kind: 'task',
    workspaceId,
    taskId,
  }),
  ofTeam: (workspaceId: WorkspaceId, teamId: TeamId): DeletionScope => ({
    kind: 'team',
    workspaceId,
    teamId,
  }),
  ofWorkspace: (workspaceId: WorkspaceId): DeletionScope => ({
    kind: 'workspace',
    workspaceId,
  }),
};
