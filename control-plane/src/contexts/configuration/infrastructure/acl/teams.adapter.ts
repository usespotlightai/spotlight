import type {
  TeamProfile,
  TeamStanding,
  TeamsPort,
} from '@configuration/application/ports/teams.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class Teams implements TeamsPort {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly directory: TeamDirectoryPort,
    private readonly connections: WorkspaceConnectionsPort,
  ) {}

  async find(teamId: TeamId): Promise<TeamProfile | null> {
    const team = await this.directory.find(teamId);

    return team ? this.configured(team.workspaceId, team.id) : null;
  }

  async viewedBy(teamId: string, viewer: UserId): Promise<TeamStanding | null> {
    const standing = await this.access.onTeam(teamId, viewer);

    return standing
      ? {
          ...(await this.configured(standing.workspaceId, standing.teamId)),
          viewer,
          administers: standing.administers,
        }
      : null;
  }

  async inWorkspace(workspaceId: WorkspaceId): Promise<readonly TeamProfile[]> {
    const connected = await this.connections.isConnected(workspaceId);

    return (await this.directory.inWorkspace(workspaceId)).map((team) => ({
      teamId: team.id,
      workspaceId,
      connected,
    }));
  }

  private async configured(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<TeamProfile> {
    return {
      teamId,
      workspaceId,
      connected: await this.connections.isConnected(workspaceId),
    };
  }
}
