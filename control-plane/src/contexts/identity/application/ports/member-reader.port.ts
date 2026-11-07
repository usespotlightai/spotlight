import type { PersonSummary } from '@identity/application/ports/person-reader.port';
import type { TeamRef } from '@identity/application/read-models/team-ref';
import type { WorkspaceRoleName } from '@identity/domain/value-objects/workspace-role.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const MEMBER_READER = Symbol('MEMBER_READER');

export interface TeamMemberSummary extends PersonSummary {
  readonly role: WorkspaceRoleName;
}

export interface WorkspaceMemberSummary extends PersonSummary {
  readonly email: string;
  readonly role: WorkspaceRoleName;
  readonly teams: readonly TeamRef[];
  readonly joinedAt: Date;
}

export interface MemberReaderPort {
  listForTeam(
    teamId: TeamId,
    workspaceId: WorkspaceId,
  ): Promise<readonly TeamMemberSummary[]>;

  listForWorkspace(
    workspaceId: WorkspaceId,
  ): Promise<readonly WorkspaceMemberSummary[]>;
}
