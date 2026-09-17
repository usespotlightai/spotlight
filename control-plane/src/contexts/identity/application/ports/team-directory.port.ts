import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const TEAM_DIRECTORY = Symbol('TEAM_DIRECTORY');

export interface TeamProfile {
  readonly id: TeamId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly members: readonly UserId[];
}

export const holds = (team: TeamProfile, userId: UserId): boolean =>
  team.members.some((each) => each.equals(userId));

export interface TeamDirectoryPort {
  find(teamId: TeamId): Promise<TeamProfile | null>;

  inWorkspace(workspaceId: WorkspaceId): Promise<readonly TeamProfile[]>;
}
