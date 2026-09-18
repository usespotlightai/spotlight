import type {
  TeamDirectoryPort,
  TeamProfile,
} from '@identity/application/ports/team-directory.port';
import type { Team } from '@identity/domain/aggregates/team.aggregate';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const profileOf = (team: Team): TeamProfile => ({
  id: team.id,
  workspaceId: team.workspaceId,
  name: team.name.value,
  members: team.members,
});

export class TeamDirectory implements TeamDirectoryPort {
  constructor(private readonly teams: TeamRepository) {}

  async find(teamId: TeamId): Promise<TeamProfile | null> {
    const team = await this.teams.find(teamId);

    return team ? profileOf(team) : null;
  }

  async inWorkspace(workspaceId: WorkspaceId): Promise<readonly TeamProfile[]> {
    return (await this.teams.ofWorkspace(workspaceId)).map(profileOf);
  }
}
