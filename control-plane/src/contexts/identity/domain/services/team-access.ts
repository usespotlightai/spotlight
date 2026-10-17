import type { Team } from '@identity/domain/aggregates/team.aggregate';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export const TeamAccess = {
  admits(team: Team, workspace: Workspace, principal: Principal): boolean {
    if (team.isDeleted || !team.workspaceId.equals(workspace.id)) {
      return false;
    }

    const permissions = workspace.permissionsFor(principal);

    if (!permissions.reads) {
      return false;
    }

    return (
      principal.kind === 'token' ||
      permissions.administers ||
      team.hasMember(principal.userId)
    );
  },
};
