import type { TeamNamed } from '@identity/application/read-models/team-named';
import type { WorkspaceRoleName } from '@identity/domain/value-objects/workspace-role.vo';

export interface MemberDto {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
  readonly role: WorkspaceRoleName;
  readonly mayBeSetTo: readonly WorkspaceRoleName[];
}

export interface WorkspaceMemberDto extends MemberDto {
  readonly email: string;
  readonly teams: readonly TeamNamed[];
  readonly joinedAt: string;
}
