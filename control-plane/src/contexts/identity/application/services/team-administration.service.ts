import type { Team } from '@identity/domain/aggregates/team.aggregate';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

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
    viewerId: string,
  ): Promise<AdministeredTeam | null> {
    const by = UserId.of(viewerId);
    const team = await this.teams.find(TeamId.of(teamId));

    if (!team) {
      return null;
    }

    const workspace = await this.workspaces.find(team.workspaceId);

    return workspace?.administeredBy(by) ? { team, workspace, by } : null;
  }
}
