import type { InviteAccepted } from '@identity/domain/events/invite-accepted.event';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';

export class InviteMemberships {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly teams: TeamRepository,
  ) {}

  async intoWorkspace(accepted: InviteAccepted): Promise<void> {
    const workspace = await this.workspaces.find(accepted.workspaceId);

    if (!workspace) {
      return;
    }

    await this.workspaces.save(
      workspace.joinedBy(accepted.userId, WorkspaceRole.member),
    );
  }

  async intoTeam(accepted: InviteAccepted): Promise<void> {
    const team = await this.teams.find(accepted.teamId);

    if (!team) {
      return;
    }

    await this.teams.save(team.joinedBy(accepted.userId));
  }
}
