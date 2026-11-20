import type { WorkspaceRoleName } from '@identity/domain/value-objects/workspace-role.vo';

export interface DirectoryMemberDto {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly role: WorkspaceRoleName;
  readonly joinedAt: string;
}
