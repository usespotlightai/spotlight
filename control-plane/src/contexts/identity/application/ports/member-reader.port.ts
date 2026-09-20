import type { PersonSummary } from '@identity/application/ports/person-reader.port';
import type { WorkspaceRoleName } from '@identity/domain/value-objects/workspace-role.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const MEMBER_READER = Symbol('MEMBER_READER');

interface TeamMemberSummary extends PersonSummary {
  readonly role: WorkspaceRoleName;
}

export interface TeamRoster {
  readonly members: readonly TeamMemberSummary[];
  readonly viewer: WorkspaceRoleName;
  readonly owners: number;
}

export interface MemberReaderPort {
  listForTeam(teamId: TeamId, viewerId: UserId): Promise<TeamRoster | null>;

  // Not viewer-scoped: matches an outside email to a member, not for reading the roster.
  byEmail(workspaceId: WorkspaceId, email: string): Promise<UserId | null>;

  onTeam(teamId: TeamId, email: string): Promise<boolean>;
}
