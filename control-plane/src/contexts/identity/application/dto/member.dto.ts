import type { TeamRef } from '@identity/application/read-models/team-ref';
import type { WorkspaceRoleName } from '@identity/domain/value-objects/workspace-role.vo';

export interface MemberDto {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
  readonly role: WorkspaceRoleName;
  readonly assignableRoles: readonly WorkspaceRoleName[];
}

export interface WorkspaceMemberDto extends MemberDto {
  readonly email: string;
  readonly teams: readonly TeamRef[];
  readonly joinedAt: string;
}
