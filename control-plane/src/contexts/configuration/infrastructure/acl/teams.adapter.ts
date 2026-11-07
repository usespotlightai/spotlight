import type {
  TeamsPort,
  ViewedTeam,
} from '@configuration/application/ports/teams.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class Teams implements TeamsPort {
  constructor(private readonly access: WorkspaceAccessPort) {}

  async viewedBy(teamId: string, viewer: UserId): Promise<ViewedTeam | null> {
    const seen = await this.access.inWorkspaceOfTeam(TeamId.of(teamId), viewer);

    return seen ? { teamId: seen.teamId, workspaceId: seen.workspaceId } : null;
  }
}
