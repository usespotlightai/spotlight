import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { WorkspaceInviteAccepted } from '@identity/domain/events/workspace-invite-accepted.event';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';

export const JOIN_WORKSPACE_ON_ACCEPT = 'identity.join-workspace-on-accept';

export const JOIN_TEAMS_ON_ACCEPT = 'identity.join-teams-on-accept';

export class InviteMemberships {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly teams: TeamRepository,
    private readonly people: PersonReaderPort,
  ) {}

  async joinWorkspace(accepted: WorkspaceInviteAccepted): Promise<void> {
    const found = await this.joinable(accepted);

    if (!found) {
      return;
    }

    const workspace = found.join(accepted.userId, accepted.spec.role);

    if (workspace !== found) {
      await this.workspaces.save(workspace);
    }
  }

  async joinTeams(accepted: WorkspaceInviteAccepted): Promise<void> {
    const workspace = await this.joinable(accepted);

    if (!workspace) {
      return;
    }

    for (const teamId of accepted.spec.teams) {
      const team = await this.teams.find(teamId);

      if (!team?.workspaceId.equals(workspace.id)) {
        continue;
      }

      const joined = team.join(accepted.userId, workspace);

      if (joined !== team) {
        await this.teams.save(joined);
      }
    }
  }

  private async joinable(
    accepted: WorkspaceInviteAccepted,
  ): Promise<Workspace | null> {
    const found = await this.workspaces.find(accepted.workspaceId);

    return found && (await this.people.find(accepted.userId)) ? found : null;
  }
}
