import { Team } from '@identity/domain/aggregates/team.aggregate';
import type { WorkspaceCreated } from '@identity/domain/events/workspace-created.event';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';

export const FIRST_TEAM = 'identity.first-team';

export class FirstTeam {
  constructor(private readonly teams: TeamRepository) {}

  async createFor(created: WorkspaceCreated): Promise<void> {
    if (!created.firstTeam) {
      return;
    }

    const team = Team.createAtSignUp({
      id: created.firstTeam.id,
      workspaceId: created.workspaceId,
      name: created.firstTeam.name,
      createdBy: created.owner,
      by: created.change.by,
    });

    await this.teams.add(team);
  }
}
