import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const TEAMS = Symbol('CONFIGURATION_TEAMS');

export interface TeamProfile {
  readonly teamId: TeamId;
  readonly workspaceId: WorkspaceId;
}

export interface TeamsPort {
  viewedBy(teamId: string, viewer: UserId): Promise<TeamProfile | null>;
}
