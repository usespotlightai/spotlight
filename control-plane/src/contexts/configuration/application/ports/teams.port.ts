import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const TEAMS = Symbol('CONFIGURATION_TEAMS');

export interface TeamProfile {
  readonly teamId: TeamId;
  readonly workspaceId: WorkspaceId;
  readonly connected: boolean;
}

export interface TeamStanding extends TeamProfile {
  readonly viewer: UserId;
  readonly administers: boolean;
}

export interface TeamsPort {
  find(teamId: TeamId): Promise<TeamProfile | null>;

  viewedBy(teamId: string, viewer: UserId): Promise<TeamStanding | null>;

  inWorkspace(workspaceId: WorkspaceId): Promise<readonly TeamProfile[]>;
}
