import type {
  TeamProfile,
  TeamsPort,
} from '@configuration/application/ports/teams.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class Teams implements TeamsPort {
  constructor(private readonly access: WorkspaceAccessPort) {}

  async viewedBy(teamId: string, viewer: UserId): Promise<TeamProfile | null> {
    const standing = await this.access.onTeam(teamId, viewer);

    return standing
      ? { teamId: standing.teamId, workspaceId: standing.workspaceId }
      : null;
  }
}
