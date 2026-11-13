import type { AvatarOf } from '@identity/application/dto/avatar-of.dto';
import type {
  WorkspaceAccessPort,
  WorkspacePermissions,
} from '@identity/application/ports/workspace-access.port';
import { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface OwnedAvatar {
  readonly owner: AvatarOwner;
  readonly permissions: WorkspacePermissions;
}

export class AvatarOwners {
  constructor(private readonly access: WorkspaceAccessPort) {}

  async of(of: AvatarOf, principal: Principal): Promise<OwnedAvatar | null> {
    if (of.kind === 'workspace') {
      const permissions = await this.access.permissionsInSlug(
        of.slug,
        principal,
      );

      return permissions
        ? { owner: AvatarOwner.workspace(permissions.workspaceId), permissions }
        : null;
    }

    const permissions = await this.access.permissionsInWorkspaceOfTeam(
      TeamId.of(of.teamId),
      principal,
    );

    return permissions
      ? {
          owner: AvatarOwner.team(permissions.workspaceId, permissions.teamId),
          permissions,
        }
      : null;
  }
}
