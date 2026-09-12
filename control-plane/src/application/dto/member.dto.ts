import type { WorkspaceRoleName } from '@domain/value-objects/workspace-role.vo';

export interface MemberDto {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
  readonly role: WorkspaceRoleName;
  readonly mayBeSetTo: readonly WorkspaceRoleName[];
}
