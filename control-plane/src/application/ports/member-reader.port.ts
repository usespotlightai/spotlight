import type { PersonSummary } from '@application/ports/person-reader.port';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { WorkspaceRoleName } from '@domain/value-objects/workspace-role.vo';

export const MEMBER_READER = Symbol('MEMBER_READER');

export interface TeamMemberSummary extends PersonSummary {
  readonly role: WorkspaceRoleName;
}

export interface TeamRoster {
  readonly members: readonly TeamMemberSummary[];
  readonly viewer: WorkspaceRoleName;
  readonly owners: number;
}

export interface MemberReaderPort {
  listForTeam(teamId: TeamId, viewerId: UserId): Promise<TeamRoster | null>;

  /**
   * A member of the workspace by their email, case-insensitively, or null where
   * none has it. Asked without a viewer: it is Spotlight matching an outside
   * name to a person, not a person reading the roster.
   */
  byEmail(workspaceId: WorkspaceId, email: string): Promise<UserId | null>;

  onTeam(teamId: TeamId, email: string): Promise<boolean>;
}
