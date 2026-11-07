import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunsInWorkspace<T> {
  readonly workspaceId: WorkspaceId;
  readonly found: T;
}

export interface RunsOfChat<T> {
  readonly startedBy: UserId;
  readonly teamId: TeamId;
  readonly found: T;
}
