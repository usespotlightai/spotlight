import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceInviteAccepted } from '@identity/domain/events/workspace-invite-accepted.event';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';

export class InviteMemberships {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly teams: TeamRepository,
    private readonly people: PersonReaderPort,
  ) {}

  async joined(accepted: WorkspaceInviteAccepted): Promise<void> {
    const found = await this.workspaces.find(accepted.workspaceId);

    if (!found || !(await this.people.find(accepted.userId))) {
      return;
    }

    const workspace = found.join(accepted.userId, accepted.spec.role);

    if (workspace !== found) {
      await this.workspaces.save(workspace);
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
}
