import type { Team } from '@identity/domain/aggregates/team.aggregate';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import type { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface AdministeredTeam {
  readonly team: Team;
  readonly workspace: Workspace;
  readonly by: UserId;
}

export class TeamAdministration {
  constructor(
    private readonly teams: TeamRepository,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  async administeredBy(
    teamId: string,
    principal: PersonPrincipal,
  ): Promise<AdministeredTeam | null> {
    const team = await this.teams.find(TeamId.of(teamId));

    if (!team) {
      return null;
    }

    const workspace = await this.workspaces.find(team.workspaceId);

    return workspace?.permissionsFor(principal).isAdmin
      ? { team, workspace, by: principal.userId }
      : null;
  }
}
