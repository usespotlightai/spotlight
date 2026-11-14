import type { Team } from '@identity/domain/aggregates/team.aggregate';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { Permissions } from '@identity/domain/value-objects/permissions.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export const TeamAccess = {
  permissionsInWorkspaceOf(
    team: Team,
    workspace: Workspace,
    principal: Principal,
  ): Permissions {
    return team.isDeleted || !team.workspaceId.equals(workspace.id)
      ? Permissions.none
      : workspace.permissionsFor(principal);
  },

  actsOnTeam(team: Team, workspace: Workspace, principal: Principal): boolean {
    const permissions = TeamAccess.permissionsInWorkspaceOf(
      team,
      workspace,
      principal,
    );

    return (
      permissions.reads &&
      (principal.kind === 'token' ||
        permissions.isAdmin ||
        team.hasMember(principal.userId))
    );
  },

  joinedTeam(team: Team, workspace: Workspace, principal: Principal): boolean {
    return (
      principal.kind === 'person' &&
      team.hasMember(principal.userId) &&
      TeamAccess.actsOnTeam(team, workspace, principal)
    );
  },
};
