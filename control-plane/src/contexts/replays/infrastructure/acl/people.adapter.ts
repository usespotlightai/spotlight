import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type {
  PeoplePort,
  ReadableTeam,
} from '@replays/application/ports/people.port';
import type { Membership } from '@replays/domain/services/team-access';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class People implements PeoplePort {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly workspaces: WorkspaceReaderPort,
  ) {}

  async membershipOn(
    teamId: string,
    principal: Principal,
  ): Promise<Membership | null> {
    const permissions = await this.access.permissionsAsTeamReader(
      teamId,
      principal,
    );

    return permissions
      ? {
          workspaceId: permissions.workspaceId,
          mayPlan: this.access.mayPlan(principal),
        }
      : null;
  }

  async teamKey(teamId: TeamId): Promise<string | null> {
    return (await this.teams.find(teamId))?.key ?? null;
  }

  workspaceSlug(workspaceId: WorkspaceId): Promise<string | null> {
    return this.workspaces.slugOf(workspaceId.value);
  }

  async readableTeams(
    workspaceId: string,
    principal: Principal,
  ): Promise<readonly ReadableTeam[] | null> {
    const workspace = await this.access.permissionsIn(
      WorkspaceId.of(workspaceId),
      principal,
    );

    if (!workspace) {
      return null;
    }

    const teams = await this.teams.inWorkspace(workspace.workspaceId);
    const read = await Promise.all(
      teams.map(async (team) =>
        (await this.access.permissionsAsTeamReader(team.id.value, principal))
          ? [{ teamId: team.id, workspaceId: team.workspaceId, key: team.key }]
          : [],
      ),
    );

    return read.flat();
  }
}
