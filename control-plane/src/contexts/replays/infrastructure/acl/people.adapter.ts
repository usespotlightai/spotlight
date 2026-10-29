import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { Membership } from '@replays/domain/services/team-access';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class People implements PeoplePort {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
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
}
