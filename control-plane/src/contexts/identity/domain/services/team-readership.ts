import type { Team } from '@identity/domain/aggregates/team.aggregate';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export const TeamReadership = {
  admits(team: Team, workspace: Workspace, principal: Principal): boolean {
    if (team.isDisbanded || !team.workspaceId.equals(workspace.id)) {
      return false;
    }

    const cleared = workspace.clearanceFor(principal);

    if (!cleared.reads) {
      return false;
    }

    return (
      principal.kind === 'token' ||
      cleared.administers ||
      team.holds(principal.userId)
    );
  },
};
