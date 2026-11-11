import type { WorkspaceRoleName } from '@identity/domain/value-objects/workspace-role.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface WorkspaceRolesPort {
  rolesOf(
    person: UserId,
    workspaces: readonly WorkspaceId[],
  ): Promise<ReadonlyMap<string, WorkspaceRoleName>>;
}
